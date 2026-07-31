import type { Collection } from "mongodb";
import type { TextCompletionPort } from "../../ai/ports/text-completion.types";
import type { EmbeddingPort } from "../../ai/ports/embedding.types";
import type { RoadmapExternalService } from "../external/roadmap.external.service";
import type { CareerDirectionExample } from "../knowledge/career-direction.types";
import type { RoadmapFeatureFlags } from "./feature-flags";
import type { RoadmapGenerationResponse } from "./roadmap-generation.types";
import { resolveUserStartingPoint } from "./user-starting-point.utils";
import type { UserCareerContext } from "./gap-analysis.types";
import { resolveStageCountFromTargetYears, formatTargetTimelineLabel } from "./roadmap-stage-count.utils";
import { DEFAULT_AVAILABLE_HOURS_PER_WEEK, ROADMAP_GENERATION_VERSION } from "./generation-meta.consts";
import { rankCareerPaths } from "./path/path-ranking";
import { resolveSelectedCareerPath } from "./path/career-path-resolution";
import { resolveRoleMilestonePlan } from "./path/role-milestones";
import { buildStructuredGapAnalysis, projectLegacyGapAnalysis } from "./structured/scored-gaps";
import { buildDeterministicStages } from "./builder/deterministic-stage-builder";
import { mapDeterministicStageToGeneratedContent } from "./deterministic-stage-mapper";
import { applyRoadmapPolish } from "./polish/roadmap-polish.service";
import { normalizeCapabilityTexts } from "./catalog/capability-normalization";
import { withSpan } from "../../observability/tracing";

type CareerDirectionProjection = Pick<
    CareerDirectionExample,
    "directionName" | "relatedSkills" | "exampleTasks" | "exampleRoles"
>;

export class RoadmapGenerationService {
    constructor(
        private readonly textCompletion: TextCompletionPort,
        private readonly externalService: RoadmapExternalService,
        private readonly directionCollection: Collection<CareerDirectionExample>,
        private readonly embedding: EmbeddingPort,
        private readonly directionVectorIndexName: string,
        private readonly featureFlags: RoadmapFeatureFlags
    ) {}

    generate = async (
        userId: string,
        dreamJob: string,
        targetYears: number,
        availableHoursPerWeek?: number
    ): Promise<RoadmapGenerationResponse> => {
        return withSpan("roadmap.generate", { "roadmap.target_years": targetYears }, async (span) => {
            span.setAttribute("roadmap.deterministic", this.featureFlags.deterministicCoreEnabled);
            const stageCount = resolveStageCountFromTargetYears(targetYears);
            await this.externalService.refreshCareerKnowledge();

            const context = await withSpan("roadmap.generate.context", {}, async () => {
                const [userProfile, careerProfile, directions] = await Promise.all([
                    this.externalService.readUserPublicProfile(userId).catch(() => null),
                    this.externalService.readCareerProfile(userId).catch(() => null),
                    this.searchCareerDirections(dreamJob).catch(() => []),
                ]);

                const startingPoint = resolveUserStartingPoint(userProfile, careerProfile);
                const userContext: UserCareerContext = {
                    currentJob: startingPoint.currentJob,
                    currentRoleSummary: startingPoint.currentRoleSummary,
                    userSkills: startingPoint.userSkills,
                    demonstratedResponsibilities: startingPoint.demonstratedResponsibilities,
                    roleExperienceYears: startingPoint.roleExperienceYears,
                    roleExperienceLevel: startingPoint.roleExperienceLevel,
                    preferredDomains: startingPoint.preferredDomains,
                    senioritySignal: startingPoint.isEntryLevel ? null : startingPoint.roleExperienceLevel,
                    longTermGoals: startingPoint.longTermGoals,
                    isEntryLevel: startingPoint.isEntryLevel,
                };

                const market = await this.externalService.getMarketRequirements(dreamJob).catch(() => null);
                const careerPaths = await this.externalService
                    .getCareerPaths(userContext.currentJob, dreamJob)
                    .catch(() => []);

                return { startingPoint, userContext, market, careerPaths, directions };
            });

            const pathResult = await withSpan("roadmap.generate.path_rank", {}, async () =>
                rankCareerPaths({
                    currentJob: context.userContext.currentJob,
                    dreamJob,
                    knownPaths: context.careerPaths,
                    directionSkills: context.directions.flatMap((direction) => direction.relatedSkills).slice(0, 20),
                })
            );

            const selectedCareerPath = resolveSelectedCareerPath({
                currentJob: context.userContext.currentJob,
                dreamJob,
                targetYears,
                knownPathRoles: context.careerPaths.flatMap((path) => [path.fromRole, path.toRole]),
                isEntryLevel: context.userContext.isEntryLevel === true,
                hasNoSkills: context.userContext.userSkills.length === 0,
            });

            const milestonePlan = resolveRoleMilestonePlan({
                dreamJob,
                targetYears,
                isEntryLevel: context.userContext.isEntryLevel === true,
                hasNoSkills: context.userContext.userSkills.length === 0,
            });

            const transitionRelevanceByCapabilityId = new Map<string, number>();
            for (const skill of pathResult.selected.path.requiredSkills) {
                const normalized = normalizeCapabilityTexts([skill])[0];
                if (normalized) transitionRelevanceByCapabilityId.set(normalized.id, 1.25);
            }

            const structured = await withSpan("roadmap.generate.structured_gaps", {}, async () =>
                buildStructuredGapAnalysis({
                    user: context.userContext,
                    market: context.market,
                    dreamJob,
                    pathSkills: pathResult.selected.path.requiredSkills,
                    transitionRelevanceByCapabilityId,
                })
            );

            const gapAnalysis = projectLegacyGapAnalysis({
                gaps: structured.gaps,
                user: context.userContext,
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

            const hoursPerWeek = availableHoursPerWeek ?? DEFAULT_AVAILABLE_HOURS_PER_WEEK;
            const assumedAvailability = availableHoursPerWeek === undefined;

            const builtStages = await withSpan("roadmap.generate.deterministic_builder", {}, async () =>
                buildDeterministicStages({
                    dreamJob,
                    preferredStageCount: stageCount,
                    gaps: structured.gaps,
                    preparedForRoles: selectedCareerPath.steps,
                    milestonePlan,
                    hoursPerWeek,
                    assumedAvailability,
                    measurableCompletionEnabled: this.featureFlags.measurableCompletionEnabled,
                    structuredEvidenceEnabled: this.featureFlags.structuredEvidenceEnabled,
                })
            );

            const polishResult = this.featureFlags.aiPolishEnabled
                ? await withSpan("roadmap.generate.ai_polish", {}, async () =>
                      applyRoadmapPolish({
                          textCompletion: this.textCompletion,
                          userId,
                          dreamJob,
                          stages: builtStages,
                      })
                  )
                : { stages: builtStages, polished: false, reasonCodes: ["ai_polish_disabled"] as const };

            const generationMode = polishResult.polished ? "deterministic-polished" : "deterministic";
            const stages = polishResult.stages.map(mapDeterministicStageToGeneratedContent);
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
                (sum, stage) => sum + (stage.timelineMeta?.minMonths ?? Math.round((stage.timelineMeta?.estimatedWeeks ?? 8) / 4.345)),
                0
            );
            const totalMaxMonths = stages.reduce(
                (sum, stage) => sum + (stage.timelineMeta?.maxMonths ?? Math.round((stage.timelineMeta?.estimatedWeeks ?? 12) / 4.345)),
                0
            );
            // Overlap discount: sequential career stages share calendar time.
            const overlapFactor = 0.55;
            const totalTimeline = {
                minYears: Math.max(1, Math.round(((totalMinMonths * overlapFactor) / 12) * 2) / 2),
                maxYears: Math.max(1, Math.round(((totalMaxMonths * overlapFactor) / 12) * 2) / 2),
                overlappingStages: true,
                assumptions: [
                    `User target horizon up to ${formatTargetTimelineLabel(targetYears)}`,
                    `Assumes ~${hoursPerWeek} hours/week when availability is unspecified`,
                    "Stage timelines overlap; totals are not a blind sum",
                    "Completing stages does not guarantee the target role",
                ],
            };

            span.setAttribute("roadmap.generation_mode", generationMode);
            span.setAttribute("roadmap.stage_count", stages.length);
            span.setAttribute("roadmap.removed_inputs", removedInputExamples.length);

            return {
                stages,
                gapAnalysis,
                generationVersion: ROADMAP_GENERATION_VERSION,
                generationMode,
                selectedPath: selectedPathMeta,
                selectedCareerPath: [...selectedCareerPath.steps],
                structuredGapAnalysis,
                removedInputExamples,
                progressionMeta: {
                    currentRoleSummary: context.startingPoint.currentRoleSummary,
                    dreamRoleCategory: dreamJob,
                    estimatedYearsToGoal: `${totalTimeline.minYears}–${totalTimeline.maxYears} years (overlapping stages; not guaranteed)`,
                    progressionReasoning: milestonePlan
                        ? "Role-based path: foundations → cybersecurity job → senior IC → team lead → org leadership → executive/commercial readiness."
                        : context.startingPoint.isEntryLevel
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
                },
            };
        });
    };

    private searchCareerDirections = async (dreamJob: string): Promise<CareerDirectionProjection[]> => {
        const vector = await this.embedding.embedCareerDirection(dreamJob);
        if (vector.length === 0) return [];
        const results = await this.directionCollection
            .aggregate([
                {
                    $vectorSearch: {
                        index: this.directionVectorIndexName,
                        path: "embedding",
                        queryVector: vector,
                        numCandidates: 24,
                        limit: 3,
                    },
                },
                {
                    $project: {
                        _id: 0,
                        directionName: 1,
                        relatedSkills: 1,
                        exampleTasks: 1,
                        exampleRoles: 1,
                    },
                },
            ])
            .toArray()
            .catch(() => []);
        return results as CareerDirectionProjection[];
    };
}
