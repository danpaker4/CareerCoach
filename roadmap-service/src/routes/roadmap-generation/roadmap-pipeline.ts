import type { CareerPathSummary } from "../external/roadmap.external.service";
import type { MarketRequirementsContext, UserCareerContext } from "./gap-analysis.types";
import type { RoadmapFeatureFlags } from "./feature-flags";
import type { CareerPathOption, RoadmapGenerationResponse, RoadmapPreferences } from "./roadmap-generation.types";
import { resolveStageCountFromTargetYears, formatTargetTimelineLabel } from "./roadmap-stage-count.utils";
import { DEFAULT_AVAILABLE_HOURS_PER_WEEK, ROADMAP_GENERATION_VERSION } from "./generation-meta.consts";
import { rankCareerPaths } from "./path/path-ranking";
import { resolveSelectedCareerPath } from "./path/career-path-resolution";
import { resolveRoleMilestonePlan } from "./path/role-milestones";
import { buildStructuredGapAnalysis, projectLegacyGapAnalysis } from "./structured/scored-gaps";
import { buildDeterministicStages } from "./builder/deterministic-stage-builder";
import { mapDeterministicStageToGeneratedContent } from "./deterministic-stage-mapper";
import { normalizeCapabilityTexts } from "./catalog/capability-normalization";
import type { UserStartingPoint } from "./user-starting-point.utils";

export type RoadmapPipelineInput = {
    readonly dreamJob: string;
    readonly targetYears: number;
    readonly availableHoursPerWeek?: number;
    readonly userContext: UserCareerContext;
    readonly startingPoint: Pick<UserStartingPoint, "currentRoleSummary" | "isEntryLevel">;
    readonly market: MarketRequirementsContext | null;
    readonly careerPaths: readonly CareerPathSummary[];
    readonly directionSkills?: readonly string[];
    readonly featureFlags: RoadmapFeatureFlags;
    readonly preferences?: RoadmapPreferences;
};

export type RoadmapPipelineResult = {
    readonly response: RoadmapGenerationResponse;
    readonly deterministicStages: ReturnType<typeof buildDeterministicStages>;
};

const buildAlternativePaths = (
    dreamJob: string,
    primaryRoles: readonly string[],
    rankedRoles: readonly { readonly fromRole: string; readonly toRole: string }[]
): CareerPathOption[] => {
    const primary: CareerPathOption = {
        id: "path.recommended",
        label: "Recommended path",
        summary: `The strongest progression from your current profile toward ${dreamJob}.`,
        roles: [...primaryRoles],
        isRecommended: true,
    };
    const isExecutiveGoal = /\b(ceo|chief executive|founder)\b/i.test(dreamJob);
    if (isExecutiveGoal) {
        return [
            primary,
            {
                id: "path.founder",
                label: "Founder path",
                summary: "Validate a real customer problem, build commercial traction, and grow into the chief executive role.",
                roles: ["Domain specialist", "Product owner / founder", "Founder", dreamJob],
                isRecommended: false,
            },
            {
                id: "path.functional-leader",
                label: "Functional leadership path",
                summary: "Grow through senior functional leadership, general management, and company-wide ownership.",
                roles: ["Senior individual contributor", "Team lead", "Director / VP", "General manager", dreamJob],
                isRecommended: false,
            },
        ];
    }
    const alternatives = rankedRoles
        .filter((path) => path.fromRole !== primaryRoles[0] || path.toRole !== primaryRoles[primaryRoles.length - 1])
        .slice(0, 2)
        .map((path, index): CareerPathOption => ({
            id: `path.alternative.${index + 1}`,
            label: `Alternative path ${index + 1}`,
            summary: `A related transition through ${path.fromRole} toward ${path.toRole}.`,
            roles: [path.fromRole, path.toRole, dreamJob].filter((role, roleIndex, all) => all.indexOf(role) === roleIndex),
            isRecommended: false,
        }));
    return [primary, ...alternatives];
};

export const buildRoadmapPipeline = (input: RoadmapPipelineInput): RoadmapPipelineResult => {
    const stageCount = resolveStageCountFromTargetYears(input.targetYears);
    const dreamJob = input.dreamJob;
    const pathResult = rankCareerPaths({
        currentJob: input.userContext.currentJob,
        dreamJob,
        knownPaths: input.careerPaths,
        directionSkills: input.directionSkills ?? [],
    });

    const selectedCareerPath = resolveSelectedCareerPath({
        currentJob: input.userContext.currentJob,
        dreamJob,
        targetYears: input.targetYears,
        knownPathRoles: input.careerPaths.flatMap((path) => [path.fromRole, path.toRole]),
        isEntryLevel: input.userContext.isEntryLevel === true,
        hasNoSkills: input.userContext.userSkills.length === 0,
    });

    const milestonePlan = resolveRoleMilestonePlan({
        dreamJob,
        targetYears: input.targetYears,
        isEntryLevel: input.userContext.isEntryLevel === true,
        hasNoSkills: input.userContext.userSkills.length === 0,
    });

    const transitionRelevanceByCapabilityId = new Map<string, number>();
    for (const skill of pathResult.selected.path.requiredSkills) {
        const normalized = normalizeCapabilityTexts([skill])[0];
        if (normalized) transitionRelevanceByCapabilityId.set(normalized.id, 1.25);
    }

    const structured = buildStructuredGapAnalysis({
        user: input.userContext,
        market: input.market,
        dreamJob,
        pathSkills: pathResult.selected.path.requiredSkills,
        transitionRelevanceByCapabilityId,
    });

    const gapAnalysis = projectLegacyGapAnalysis({
        gaps: structured.gaps,
        user: input.userContext,
        dreamJob,
    });

    const selectedPathMeta = {
        fromRole: pathResult.selected.path.fromRole,
        toRole: pathResult.selected.path.toRole,
        requiredSkills: [...pathResult.selected.path.requiredSkills],
        overlapScore: pathResult.selected.path.overlapScore,
        source: pathResult.selected.path.source,
        rankScore: pathResult.selected.rankScore,
        reasonCodes: [...pathResult.selected.reasonCodes, ...selectedCareerPath.reasonCodes],
        selectedCareerPath: [...selectedCareerPath.steps],
    };
    const alternativePaths = buildAlternativePaths(
        dreamJob,
        selectedCareerPath.steps,
        pathResult.candidates.map((candidate) => candidate.path)
    );

    const hoursPerWeek = input.availableHoursPerWeek ?? DEFAULT_AVAILABLE_HOURS_PER_WEEK;
    const assumedAvailability = input.availableHoursPerWeek === undefined;

    const builtStages = buildDeterministicStages({
        dreamJob,
        preferredStageCount: stageCount,
        gaps: structured.gaps,
        preparedForRoles: selectedCareerPath.steps,
        milestonePlan,
        hoursPerWeek,
        assumedAvailability,
        measurableCompletionEnabled: input.featureFlags.measurableCompletionEnabled,
        structuredEvidenceEnabled: input.featureFlags.structuredEvidenceEnabled,
        courseBudget: input.preferences?.courseBudget ?? "mixed",
    });

    const generationMode = "deterministic";
    const stages = builtStages.map(mapDeterministicStageToGeneratedContent);
    const structuredGapAnalysis = {
        gaps: structured.gaps.map((gap) => ({
            gapId: gap.gapId,
            capabilityId: gap.capabilityId,
            label: gap.label,
            category: gap.category,
            requiredLevel: gap.requiredLevel,
            currentLevel: gap.currentLevel,
            gapScore: gap.gapScore,
            marketImportance: gap.marketImportance,
            priorityScore: gap.priorityScore,
            reasonCodes: [...gap.reasonCodes],
        })),
    };

    const removedInputExamples = structured.removedInputs.slice(0, 40).map((item) => ({
        input: item.input,
        reason: item.reason,
    }));

    const totalMinMonths = stages.reduce(
        (sum, stage) =>
            sum + (stage.timelineMeta?.minMonths ?? Math.round((stage.timelineMeta?.estimatedWeeks ?? 8) / 4.345)),
        0
    );
    const totalMaxMonths = stages.reduce(
        (sum, stage) =>
            sum + (stage.timelineMeta?.maxMonths ?? Math.round((stage.timelineMeta?.estimatedWeeks ?? 12) / 4.345)),
        0
    );
    const overlapFactor = 0.55;
    const totalTimeline = {
        minYears: Math.max(1, Math.round(((totalMinMonths * overlapFactor) / 12) * 2) / 2),
        maxYears: Math.max(1, Math.round(((totalMaxMonths * overlapFactor) / 12) * 2) / 2),
        overlappingStages: true,
        assumptions: [
            `User target horizon up to ${formatTargetTimelineLabel(input.targetYears)}`,
            `Assumes ~${hoursPerWeek} hours/week when availability is unspecified`,
            "Stage timelines overlap; totals are not a blind sum",
            "Completing stages does not guarantee the target role",
        ],
    };
    const managementConflict = /\b(ceo|chief executive|founder)\b/i.test(dreamJob) && input.preferences?.willingToManagePeople === false;
    const timelineAmbitious = totalTimeline.maxYears > input.targetYears;
    const feasibility = managementConflict
        ? {
              status: "conflict" as const,
              message: `The current preference not to manage people conflicts with the responsibilities of ${dreamJob}.`,
              reasons: ["Executive roles require sustained people and organization leadership experience."],
          }
        : timelineAmbitious
          ? {
                status: "ambitious" as const,
                message: `The ${input.targetYears}-year target is ambitious; the evidence-based estimate is ${totalTimeline.minYears}–${totalTimeline.maxYears} years.`,
                reasons: ["The requested date is treated as a target, not a guaranteed deadline."],
            }
          : {
                status: "on-track" as const,
                message: `The plan fits the requested ${input.targetYears}-year horizon under the stated assumptions.`,
                reasons: [],
            };

    return {
        response: {
            stages,
            gapAnalysis,
            generationVersion: ROADMAP_GENERATION_VERSION,
            generationMode,
            selectedPath: selectedPathMeta,
            selectedCareerPath: [...selectedCareerPath.steps],
            structuredGapAnalysis,
            removedInputExamples,
            progressionMeta: {
                currentRoleSummary: input.startingPoint.currentRoleSummary,
                dreamRoleCategory: dreamJob,
                estimatedYearsToGoal: `${totalTimeline.minYears}–${totalTimeline.maxYears} years (overlapping stages; not guaranteed)`,
                targetYears: input.targetYears,
                progressionReasoning: milestonePlan
                    ? milestonePlan.reasonCodes.includes("architecture_ic")
                      ? "Role-based path: focused skill gaps → senior/architect job → staff scope → principal scope → pursue Principal Architect roles."
                      : milestonePlan.reasonCodes.includes("engineering_ic")
                        ? "Role-based path: close skill gaps → engineering job → senior IC growth."
                        : "Role-based path: foundations → cybersecurity job → senior IC → team lead → org leadership → executive/commercial readiness."
                    : input.startingPoint.isEntryLevel
                      ? "Cleaned market inputs into an experience-first path with intermediate roles toward the target."
                      : "Cleaned market inputs, ranked transitions, and built focused stages with measurable evidence.",
                gapAnalysis,
                generationVersion: ROADMAP_GENERATION_VERSION,
                generationMode,
                selectedPath: selectedPathMeta,
                selectedCareerPath: [...selectedCareerPath.steps],
                structuredGapAnalysis,
                removedInputExamples,
                totalTimeline,
                alternativePaths,
                ...(input.preferences ? { preferences: input.preferences } : {}),
                feasibility,
            },
        },
        deterministicStages: builtStages,
    };
};
