import { ACTIONS_CATALOG, RESOURCES_CATALOG, STAGE_TEMPLATES } from "../catalog/actions-resources.consts";
import type { CatalogAction, CatalogResource, StageTemplate } from "../catalog/catalog.types";
import { CAPABILITY_BY_ID } from "../catalog/capability-catalog.consts";
import { familyRank, resolveCapabilityFamily, resolveStageFocusLabel } from "../catalog/capability-families.utils";
import { getCapabilityMinCalendarWeeks } from "../catalog/capability-normalization";
import { MAX_PRIMARY_CAPABILITIES_PER_STAGE } from "../cleaning/market-requirement-cleaner.consts";
import { buildCapabilityDependencyOrder } from "../deps/capability-dependency-graph";
import { DEFAULT_AVAILABLE_HOURS_PER_WEEK } from "../generation-meta.consts";
import type { RoleMilestonePlan } from "../path/role-milestones.types";
import { MAX_STAGE_COUNT } from "../roadmap-generation.consts";
import type { CapabilityGap } from "../structured/structured-gap.types";
import { computeBaseWeeks, formatMonthRangeAsTimeframe } from "../scoring/roadmap-scoring";
import { buildStageActionPlan } from "../actionable-routes/actionable-routes";
import type { UserCareerContext } from "../gap-analysis.types";
import type { CompletionCriterion, DeterministicStage } from "./deterministic-stage-builder.types";

const fillPattern = (pattern: string, focus: string, dreamJob: string): string =>
    pattern.replaceAll("{focus}", focus).replaceAll("{dreamJob}", dreamJob);

const shortFocusLabel = (label: string): string => {
    const trimmed = label.trim();
    if (trimmed.length <= 42) return trimmed;
    return `${trimmed.slice(0, 39).trim()}…`;
};

const isSkillLikeGap = (gap: CapabilityGap): boolean =>
    gap.category === "technical" || gap.category === "domain" || gap.category === "architecture";

const isEducationOrCertGap = (gap: CapabilityGap): boolean =>
    gap.category === "credential" ||
    gap.reasonCodes.some((code) => code.includes("EDUCATION") || code.includes("CERTIFICATION"));

const CONCRETE_ACTION_BY_CAPABILITY: ReadonlyMap<string, { title: string; evidence: string; minWeeks: number; effortHours: number }> = new Map([
    [
        "cap.credential.cs.degree",
        {
            title: "Complete a CS degree track or an equivalent multi-year project portfolio with assessed depth",
            evidence: "Degree progress transcript or equivalent portfolio review notes",
            minWeeks: 156,
            effortHours: 3600,
        },
    ],
    [
        "cap.cybersecurity",
        {
            title: "Complete a cybersecurity fundamentals lab path covering networks, threats, and controls",
            evidence: "Lab write-ups and a personal security notes wiki",
            minWeeks: 26,
            effortHours: 200,
        },
    ],
    [
        "cap.security.operations",
        {
            title: "Participate in SOC / incident-response work via job, internship, or structured volunteer blue-team practice",
            evidence: "Incident participation notes and shift or exercise logs",
            minWeeks: 52,
            effortHours: 800,
        },
    ],
    [
        "cap.security.architecture",
        {
            title: "Write two ADRs comparing security architecture options for a real system",
            evidence: "Reviewed ADRs with alternatives and trade-offs",
            minWeeks: 39,
            effortHours: 300,
        },
    ],
    [
        "cap.professional.experience",
        {
            title: "Hold cybersecurity engineering roles long enough to show independent delivery and production ownership",
            evidence: "Role tenure summary with shipped outcomes",
            minWeeks: 52,
            effortHours: 1000,
        },
    ],
    [
        "cap.leadership",
        {
            title: "Lead one scoped technical or security initiative from proposal through delivery and retrospective",
            evidence: "Initiative brief, delivery notes, and peer/manager feedback",
            minWeeks: 52,
            effortHours: 600,
        },
    ],
    [
        "cap.project.ownership",
        {
            title: "Own a business-critical deliverable end-to-end with a written retrospective",
            evidence: "Ownership retrospective with measurable outcomes",
            minWeeks: 16,
            effortHours: 160,
        },
    ],
    [
        "cap.business.finance",
        {
            title: "Build a simple operating plan / unit-economics model for a security product or services line",
            evidence: "Spreadsheet model and narrative assumptions",
            minWeeks: 26,
            effortHours: 160,
        },
    ],
    [
        "cap.executive.leadership",
        {
            title: "Present a strategy update to senior stakeholders covering risk, customers, and resourcing",
            evidence: "Strategy memo and presentation feedback",
            minWeeks: 78,
            effortHours: 800,
        },
    ],
    [
        "cap.programming.fundamentals",
        {
            title: "Ship weekly programming projects that demonstrate core CS fundamentals",
            evidence: "Public repo with tests and README",
            minWeeks: 12,
            effortHours: 120,
        },
    ],
    [
        "cap.system.design",
        {
            title: "Document a system design for a familiar product with scaling and failure modes",
            evidence: "Design doc with diagrams",
            minWeeks: 12,
            effortHours: 100,
        },
    ],
    [
        "cap.cloud.basics",
        {
            title: "Deploy and harden a small cloud service with basic security controls",
            evidence: "Deployed service URL/docs and control checklist",
            minWeeks: 8,
            effortHours: 80,
        },
    ],
    [
        "cap.portfolio",
        {
            title: "Publish case studies that show security impact and business outcomes",
            evidence: "Two public case studies",
            minWeeks: 8,
            effortHours: 80,
        },
    ],
]);

const pickActionsForGaps = (gaps: readonly CapabilityGap[]): CatalogAction[] => {
    const selected: CatalogAction[] = [];
    const used = new Set<string>();
    for (const gap of gaps.slice(0, MAX_PRIMARY_CAPABILITIES_PER_STAGE)) {
        const concrete = CONCRETE_ACTION_BY_CAPABILITY.get(gap.capabilityId);
        if (concrete) {
            const id = `act.concrete.${gap.capabilityId}`;
            if (used.has(id)) continue;
            used.add(id);
            selected.push({
                id,
                title: concrete.title,
                capabilityIds: [gap.capabilityId],
                effortHours: concrete.effortHours,
                minCalendarWeeks: concrete.minWeeks,
                progressionType: gap.category === "experience" || gap.category === "leadership" ? "experience" : "hybrid",
            });
            continue;
        }

        const match =
            ACTIONS_CATALOG.find(
                (action) => action.capabilityIds.includes(gap.capabilityId) && !used.has(action.id)
            ) ?? ACTIONS_CATALOG.find((action) => action.id === "act.experience.generic");
        if (!match || used.has(match.id)) continue;
        used.add(match.id);
        selected.push({
            ...match,
            title:
                match.id === "act.experience.generic"
                    ? `Produce documented evidence for ${gap.label} through a scoped project or workplace assignment`
                    : match.title,
            minCalendarWeeks: Math.max(match.minCalendarWeeks ?? 0, getCapabilityMinCalendarWeeks(gap.capabilityId)),
        });
    }
    return selected.slice(0, 5);
};

const pickResourcesForGaps = (gaps: readonly CapabilityGap[]): CatalogResource[] => {
    const selected: CatalogResource[] = [];
    const used = new Set<string>();
    for (const gap of gaps) {
        if (isEducationOrCertGap(gap)) continue;
        const match = RESOURCES_CATALOG.find(
            (resource) => resource.capabilityIds.includes(gap.capabilityId) && !used.has(resource.id)
        );
        if (!match) continue;
        used.add(match.id);
        selected.push(match);
    }
    return selected.slice(0, 3);
};

const buildCompletionCriteria = (stageId: string, gaps: readonly CapabilityGap[]): CompletionCriterion[] => {
    const criteria: CompletionCriterion[] = [];
    for (const [index, gap] of gaps.slice(0, 4).entries()) {
        const concrete = CONCRETE_ACTION_BY_CAPABILITY.get(gap.capabilityId);
        criteria.push({
            id: `${stageId}.criteria.${index + 1}`,
            description:
                concrete?.evidence ??
                `Produce verifiable evidence for ${gap.label} (artifact, delivery note, or reviewed outcome)`,
            metric: "artifact_ready",
            targetValue: 1,
        });
    }
    if (criteria.length === 0) {
        criteria.push({
            id: `${stageId}.criteria.actions`,
            description: "Complete listed stage actions with shareable evidence",
            metric: "actions_complete",
            targetValue: 1,
        });
    }
    return criteria;
};

const categoryArcRank = (category: CapabilityGap["category"]): number => {
    switch (category) {
        case "credential":
            return 0;
        case "technical":
            return 1;
        case "domain":
            return 2;
        case "architecture":
            return 3;
        case "experience":
            return 4;
        case "responsibility":
            return 5;
        case "leadership":
            return 6;
        case "soft":
            return 7;
        default:
            return 5;
    }
};

const orderGapsForExperienceArc = (gaps: readonly CapabilityGap[]): CapabilityGap[] => {
    const orderedIds = buildCapabilityDependencyOrder(gaps.map((gap) => gap.capabilityId)).orderedCapabilityIds;
    const byId = new Map(gaps.map((gap) => [gap.capabilityId, gap]));
    const dependencyOrdered = orderedIds
        .map((id) => byId.get(id))
        .filter((gap): gap is CapabilityGap => gap !== undefined);
    const leftover = gaps.filter((gap) => !dependencyOrdered.some((item) => item.gapId === gap.gapId));
    return [...dependencyOrdered, ...leftover].sort((a, b) => {
        const rankDelta = categoryArcRank(a.category) - categoryArcRank(b.category);
        if (rankDelta !== 0) return rankDelta;
        return b.priorityScore - a.priorityScore;
    });
};

const chunkGapsIntoArcStages = (
    gaps: readonly CapabilityGap[],
    preferredStageCount: number
): CapabilityGap[][] => {
    if (gaps.length === 0) return [];

    const sorted = [...gaps].sort((a, b) => {
        const familyDelta = familyRank(a) - familyRank(b);
        if (familyDelta !== 0) return familyDelta;
        return b.priorityScore - a.priorityScore;
    });

    const byFamily = new Map<string, CapabilityGap[]>();
    for (const gap of sorted) {
        const family = resolveCapabilityFamily(gap);
        const key = family.id === "other" ? `other:${gap.capabilityId}` : family.id;
        const bucket = byFamily.get(key) ?? [];
        bucket.push(gap);
        byFamily.set(key, bucket);
    }

    const maxGapsForFamily = (familyKey: string): number => {
        if (familyKey.startsWith("other:")) return 1;
        if (familyKey === "programming" || familyKey === "data_ml" || familyKey === "cloud_infra" || familyKey === "frontend") {
            return 2;
        }
        return Math.min(MAX_PRIMARY_CAPABILITIES_PER_STAGE, 3);
    };

    const familyChunks: CapabilityGap[][] = [];
    for (const [familyKey, familyGaps] of byFamily.entries()) {
        const maxGaps = maxGapsForFamily(familyKey);
        const ordered = [...familyGaps].sort((a, b) => b.priorityScore - a.priorityScore);
        for (let index = 0; index < ordered.length; index += maxGaps) {
            familyChunks.push(ordered.slice(index, index + maxGaps));
        }
    }

    familyChunks.sort((left, right) => {
        const leftRank = familyRank(left[0]!);
        const rightRank = familyRank(right[0]!);
        if (leftRank !== rightRank) return leftRank - rightRank;
        return (right[0]?.priorityScore ?? 0) - (left[0]?.priorityScore ?? 0);
    });

    const maxStages = Math.min(MAX_STAGE_COUNT, Math.max(preferredStageCount, familyChunks.length, 2));
    if (familyChunks.length <= maxStages) return familyChunks;

    // Prefer dropping lowest-priority leftover gaps over merging unrelated skill families.
    const kept = familyChunks.slice(0, maxStages);
    return kept.map((chunk) => chunk.slice(0, maxGapsForFamily(resolveCapabilityFamily(chunk[0]!).id)));
};

const resolveTemplateForChunk = (gaps: readonly CapabilityGap[], index: number, total: number): StageTemplate => {
    if (index === total - 1 && total > 1) {
        const target = STAGE_TEMPLATES.find((template) => template.id === "tpl.target");
        if (target) return target;
    }

    const dominant = [...gaps].sort((a, b) => b.priorityScore - a.priorityScore)[0];
    const byCategory = STAGE_TEMPLATES.find(
        (template) =>
            dominant !== undefined && template.categories.includes(dominant.category) && template.id !== "tpl.target"
    );
    if (byCategory) return byCategory;

    return STAGE_TEMPLATES[Math.min(index, STAGE_TEMPLATES.length - 1)] ?? STAGE_TEMPLATES[0]!;
};

const buildUniqueStageLabel = (
    template: StageTemplate,
    focus: string,
    dreamJob: string,
    index: number,
    used: Set<string>
): string => {
    const base = fillPattern(template.labelPattern, shortFocusLabel(focus), dreamJob);
    if (!used.has(base)) {
        used.add(base);
        return base;
    }
    const numbered = `${base} (${index + 1})`;
    used.add(numbered);
    return numbered;
};

const weeksToMonthRange = (weeks: number): { minMonths: number; maxMonths: number } => {
    const months = weeks / 4.345;
    if (months < 6) {
        return { minMonths: Math.max(1, Math.round(months * 0.75)), maxMonths: Math.max(2, Math.round(months * 1.25)) };
    }
    if (months < 18) {
        return { minMonths: Math.round(months * 0.8), maxMonths: Math.round(months * 1.3) };
    }
    return {
        minMonths: Math.round(months * 0.75),
        maxMonths: Math.round(months * 1.25),
    };
};

const buildExperienceTarget = (gaps: readonly CapabilityGap[]): string => {
    const experienceGaps = gaps.filter((gap) => gap.category === "experience" || gap.category === "leadership");
    if (experienceGaps.length === 0) {
        return "Produce portable proof (projects, reviews, or delivery notes) that these capabilities were applied, not only studied.";
    }
    return `Build sustained evidence for ${experienceGaps
        .map((gap) => gap.label)
        .slice(0, 3)
        .join(", ")} across real work over multiple months or years—not a single short course.`;
};

const pickResourcesForCapabilityIds = (capabilityIds: readonly string[]): CatalogResource[] => {
    const selected: CatalogResource[] = [];
    const used = new Set<string>();
    for (const capabilityId of capabilityIds) {
        if (capabilityId === "cap.credential.cs.degree") continue;
        const match = RESOURCES_CATALOG.find(
            (resource) => resource.capabilityIds.includes(capabilityId) && !used.has(resource.id)
        );
        if (!match) continue;
        if (match.id === "res.coursera.google.project.management" && capabilityIds.includes("cap.product.sense")) continue;
        used.add(match.id);
        selected.push(match);
    }
    return selected.slice(0, 3);
};

const filterResourcesByBudget = (
    resources: readonly CatalogResource[],
    courseBudget: "free" | "mixed" | "paid"
): CatalogResource[] => courseBudget === "free"
    ? resources.filter((resource) => (resource.costType ?? "free") !== "paid")
    : [...resources];

const mapCatalogResource = (resource: CatalogResource, skills: readonly string[], stageOutcome?: string) => ({
    title: resource.title,
    platform: resource.platform,
    url: resource.url,
    type: resource.type,
    costType: resource.costType ?? "free" as const,
    difficulty: resource.difficulty ?? "beginner" as const,
    estimatedHours: resource.effortHours,
    skills: [...skills],
    ...(stageOutcome ? { reason: `Take this when you need structured learning for ${skills.slice(0, 2).join(" and ")}; apply it to ${stageOutcome.toLowerCase()}` } : {}),
    ...(resource.lastVerifiedAt ? { lastVerifiedAt: resource.lastVerifiedAt } : {}),
});

const buildStagesFromRoleMilestones = (params: {
    readonly dreamJob: string;
    readonly milestonePlan: RoleMilestonePlan;
    readonly hoursPerWeek: number;
    readonly assumedAvailability: boolean;
    readonly measurableCompletionEnabled: boolean;
    readonly structuredEvidenceEnabled: boolean;
    readonly courseBudget: "free" | "mixed" | "paid";
    readonly userContext: UserCareerContext;
}): DeterministicStage[] =>
    params.milestonePlan.milestones.map((milestone, index) => {
        const stageId = `stage.${index + 1}.${milestone.id}`;
        const resources = filterResourcesByBudget(pickResourcesForCapabilityIds(milestone.capabilityIds), params.courseBudget);
        const labels = milestone.capabilityIds
            .map((id) => CAPABILITY_BY_ID.get(id)?.label ?? id)
            .slice(0, MAX_PRIMARY_CAPABILITIES_PER_STAGE);
        const skillsToBuild = milestone.capabilityIds
            .map((id) => CAPABILITY_BY_ID.get(id))
            .filter((capability) => capability && (capability.category === "technical" || capability.category === "domain" || capability.category === "architecture"))
            .map((capability) => capability!.label);
        const responsibilitiesToGain = milestone.capabilityIds
            .map((id) => CAPABILITY_BY_ID.get(id))
            .filter((capability) => capability && (capability.category === "responsibility" || capability.category === "leadership"))
            .map((capability) => capability!.label);
        const estimatedWeeks = ((milestone.minMonths + milestone.maxMonths) / 2) * 4.345;
        const effortHours = Math.round(estimatedWeeks * params.hoursPerWeek * 0.5);
        const completionCriteria: CompletionCriterion[] = params.measurableCompletionEnabled
            ? milestone.completionCriteria.map((description, criterionIndex) => ({
                  id: `${stageId}.criteria.${criterionIndex + 1}`,
                  description,
                  metric: "artifact_ready" as const,
                  targetValue: 1,
              }))
            : [];
        const roleCategories =
            milestone.progressionType === "learning" ? [] : [milestone.targetRole];
        const futureOpportunities = [milestone.targetRole, params.dreamJob].filter(
            (role, roleIndex, all) => all.indexOf(role) === roleIndex
        );

        return {
            stageId,
            templateId: milestone.id,
            label: milestone.label,
            description: `How to get there:\n${milestone.howToGetThere}`,
            whyItMatters: milestone.whyItMatters,
            howToGetThere: milestone.howToGetThere,
            whatYouGain: milestone.whatYouGain,
            progressionType: milestone.progressionType,
            actions: [...milestone.actions],
            actionIds: milestone.actions.map((_, actionIndex) => `${milestone.id}.action.${actionIndex + 1}`),
            resources: resources.map((resource) => mapCatalogResource(resource, labels, milestone.whatYouGain)),
            resourceIds: resources.map((resource) => resource.id),
            capabilityIds: [...milestone.capabilityIds],
            gapIds: milestone.capabilityIds.map((id) => `gap.${id}`),
            skillsToBuild,
            responsibilitiesToGain,
            requiredCapabilities: labels,
            roleCategories,
            futureOpportunities,
            experienceAccumulation: `What you gain: ${milestone.whatYouGain}`,
            completionCriteria,
            timelineMeta: {
                effortHours,
                hoursPerWeek: params.hoursPerWeek,
                estimatedWeeks,
                minMonths: milestone.minMonths,
                maxMonths: milestone.maxMonths,
                assumedAvailability: params.assumedAvailability,
                assumptions: [
                    ...(params.assumedAvailability ? [`Assumes ~${params.hoursPerWeek} hours/week available`] : []),
                    "Role milestones can overlap slightly with the next stage preparation",
                    "Completing stages does not guarantee the target role",
                ],
            },
            estimatedTimeframe: formatMonthRangeAsTimeframe(milestone.minMonths, milestone.maxMonths),
            evidence: params.structuredEvidenceEnabled
                ? {
                      gapIds: milestone.capabilityIds.map((id) => `gap.${id}`),
                      capabilityIds: [...milestone.capabilityIds],
                      actionIds: milestone.actions.map((_, actionIndex) => `${milestone.id}.action.${actionIndex + 1}`),
                      resourceIds: resources.map((resource) => resource.id),
                      gapsAddressed: labels,
                      transitionReasons: [...params.milestonePlan.reasonCodes],
                      marketSignals: ["ROLE_MILESTONE_PATH"],
                  }
                : {
                      gapIds: [],
                      capabilityIds: [],
                      actionIds: [],
                      resourceIds: [],
                      gapsAddressed: [],
                      transitionReasons: [],
                      marketSignals: [],
                  },
            reasonCodes: [
                "role_milestone_builder",
                milestone.id,
                ...params.milestonePlan.reasonCodes,
                ...(milestone.minMonths >= 12 ? ["multi_year_horizon"] : []),
            ],
            prerequisiteStageIds: index === 0 ? [] : [`stage.${index}.${params.milestonePlan.milestones[index - 1]!.id}`],
            parallelStageIds:
                milestone.progressionType === "learning" && params.milestonePlan.milestones[index + 1]
                    ? [`stage.${index + 2}.${params.milestonePlan.milestones[index + 1]!.id}`]
                    : [],
            orderingReason:
                index === 0
                    ? "Start here; this stage establishes evidence required by later milestones."
                    : milestone.progressionType === "learning"
                      ? "Complete the prerequisite stage first. This learning can overlap with preparation for the next milestone."
                      : "The previous milestone provides the experience or proof required before pursuing this role.",
            actionPlan: buildStageActionPlan({
                milestone,
                user: params.userContext,
                dreamJob: params.dreamJob,
                resourceUrls: resources.map((resource) => resource.url),
            }),
        };
    });

export const buildDeterministicStages = (params: {
    readonly dreamJob: string;
    readonly preferredStageCount: number;
    readonly gaps: readonly CapabilityGap[];
    readonly preparedForRoles?: readonly string[];
    readonly milestonePlan?: RoleMilestonePlan | null;
    readonly hoursPerWeek?: number;
    readonly assumedAvailability?: boolean;
    readonly measurableCompletionEnabled?: boolean;
    readonly structuredEvidenceEnabled?: boolean;
    readonly courseBudget?: "free" | "mixed" | "paid";
    readonly userContext?: UserCareerContext;
}): DeterministicStage[] => {
    const hoursPerWeek = params.hoursPerWeek ?? DEFAULT_AVAILABLE_HOURS_PER_WEEK;
    const assumedAvailability = params.assumedAvailability ?? params.hoursPerWeek === undefined;
    const measurableCompletionEnabled = params.measurableCompletionEnabled ?? true;
    const structuredEvidenceEnabled = params.structuredEvidenceEnabled ?? true;
    const courseBudget = params.courseBudget ?? "mixed";
    const userContext: UserCareerContext = params.userContext ?? {
        currentJob: "Not specified",
        currentRoleSummary: "Profile context unavailable",
        userSkills: [],
        demonstratedResponsibilities: [],
        roleExperienceYears: 0,
        roleExperienceLevel: "entry",
        preferredDomains: [],
        senioritySignal: null,
        longTermGoals: [],
        isEntryLevel: true,
    };

    if (params.milestonePlan && params.milestonePlan.milestones.length > 0) {
        return buildStagesFromRoleMilestones({
            dreamJob: params.dreamJob,
            milestonePlan: params.milestonePlan,
            hoursPerWeek,
            assumedAvailability,
            measurableCompletionEnabled,
            structuredEvidenceEnabled,
            courseBudget,
            userContext,
        });
    }

    const preparedForRoles = params.preparedForRoles ?? [params.dreamJob];

    const orderedGaps = orderGapsForExperienceArc(
        params.gaps.filter((gap) => !gap.reasonCodes.some((code) => code.includes("PERSONAL_TRAIT")))
    );
    const effectiveGaps =
        orderedGaps.length > 0
            ? orderedGaps
            : ([
                  {
                      gapId: "gap.cap.portfolio",
                      capabilityId: "cap.portfolio",
                      label: "Portfolio and evidence",
                      category: "experience",
                      requiredLevel: 2,
                      currentLevel: 0,
                      gapScore: 2,
                      marketImportance: 0.5,
                      transitionRelevance: 1,
                      dependencyWeight: 1,
                      confidence: 0.5,
                      priorityScore: 1,
                      reasonCodes: ["empty_gap_fallback"],
                  },
                  {
                      gapId: "gap.cap.professional.experience",
                      capabilityId: "cap.professional.experience",
                      label: "Professional experience",
                      category: "experience",
                      requiredLevel: 2,
                      currentLevel: 0,
                      gapScore: 2,
                      marketImportance: 0.5,
                      transitionRelevance: 1,
                      dependencyWeight: 1,
                      confidence: 0.5,
                      priorityScore: 1,
                      reasonCodes: ["empty_gap_fallback"],
                  },
              ] as const satisfies readonly CapabilityGap[]);

    const gapChunks = chunkGapsIntoArcStages(effectiveGaps, params.preferredStageCount);
    const usedLabels = new Set<string>();

    return gapChunks.map((gaps, index) => {
        const primaryGaps = gaps.slice(0, MAX_PRIMARY_CAPABILITIES_PER_STAGE);
        const template = resolveTemplateForChunk(primaryGaps, index, gapChunks.length);
        const focus = resolveStageFocusLabel(primaryGaps);
        const actions = pickActionsForGaps(primaryGaps);
        const resources = filterResourcesByBudget(pickResourcesForGaps(primaryGaps), courseBudget);
        const effortHours = actions.reduce((sum, action) => sum + action.effortHours, 0);
        const effortWeeks = computeBaseWeeks({ effortHours, hoursPerWeek });
        const minCalendarWeeks = Math.max(
            ...actions.map((action) => action.minCalendarWeeks ?? 0),
            ...primaryGaps.map((gap) => getCapabilityMinCalendarWeeks(gap.capabilityId)),
            8
        );
        const estimatedWeeks = Math.max(effortWeeks, minCalendarWeeks);
        const { minMonths, maxMonths } = weeksToMonthRange(estimatedWeeks);
        const stageId = `stage.${index + 1}.${template.id}`;
        const capabilityIds = primaryGaps.map((gap) => gap.capabilityId);
        const gapIds = primaryGaps.map((gap) => gap.gapId);
        const requiredCapabilities = primaryGaps.map((gap) => gap.label);
        const skillsToBuild = primaryGaps.filter(isSkillLikeGap).map((gap) => gap.label);
        const responsibilitiesToGain = primaryGaps
            .filter((gap) => gap.category === "responsibility" || gap.category === "leadership")
            .map((gap) => gap.label);
        const roleForStage =
            preparedForRoles[Math.min(index, preparedForRoles.length - 1)] ?? params.dreamJob;
        const isLearningStage = template.progressionType === "learning";
        const stageLabel = buildUniqueStageLabel(template, focus, params.dreamJob, index, usedLabels);
        const stageOutcome = buildExperienceTarget(primaryGaps);

        const assumptions = [
            ...(assumedAvailability ? [`Assumes ~${hoursPerWeek} hours/week available`] : []),
            "Some learning and workplace experience may overlap",
            "Completing stages does not guarantee the target role",
        ];

        return {
            stageId,
            templateId: template.id,
            label: stageLabel,
            description: fillPattern(template.descriptionPattern, shortFocusLabel(focus), params.dreamJob),
            whyItMatters: fillPattern(template.whyItMattersPattern, shortFocusLabel(focus), params.dreamJob),
            progressionType: template.progressionType,
            actions: actions.map((action) => action.title),
            actionIds: actions.map((action) => action.id),
            resources: resources.map((resource) => mapCatalogResource(resource, requiredCapabilities, stageOutcome)),
            resourceIds: resources.map((resource) => resource.id),
            capabilityIds,
            gapIds,
            skillsToBuild,
            responsibilitiesToGain,
            requiredCapabilities,
            roleCategories: isLearningStage ? [] : [roleForStage],
            futureOpportunities: isLearningStage
                ? [params.dreamJob]
                : [roleForStage, params.dreamJob].filter(
                      (role, roleIndex, all) => all.indexOf(role) === roleIndex
                  ),
            experienceAccumulation: stageOutcome,
            completionCriteria: measurableCompletionEnabled
                ? buildCompletionCriteria(stageId, primaryGaps)
                : [],
            timelineMeta: {
                effortHours,
                hoursPerWeek,
                estimatedWeeks,
                minMonths,
                maxMonths,
                assumedAvailability,
                assumptions,
            },
            estimatedTimeframe: formatMonthRangeAsTimeframe(minMonths, maxMonths),
            evidence: structuredEvidenceEnabled
                ? {
                      gapIds,
                      capabilityIds,
                      actionIds: actions.map((action) => action.id),
                      resourceIds: resources.map((resource) => resource.id),
                      gapsAddressed: requiredCapabilities,
                      transitionReasons: primaryGaps.flatMap((gap) =>
                          gap.reasonCodes.filter((code) => code.includes("TRANSITION") || code.startsWith("archetype_"))
                      ),
                      marketSignals: primaryGaps.flatMap((gap) =>
                          gap.reasonCodes.filter((code) => code.includes("MARKET") || code.includes("HIGH_"))
                      ),
                  }
                : {
                      gapIds: [],
                      capabilityIds: [],
                      actionIds: [],
                      resourceIds: [],
                      gapsAddressed: [],
                      transitionReasons: [],
                      marketSignals: [],
                  },
            reasonCodes: [
                "deterministic_builder",
                template.id,
                "experience_arc",
                "cleaned_market_input",
                ...(assumedAvailability ? ["default_hours_assumed"] : []),
                ...(estimatedWeeks >= 52 ? ["multi_year_horizon"] : []),
            ],
            prerequisiteStageIds: index === 0 ? [] : [`stage.${index}.${resolveTemplateForChunk(gapChunks[index - 1]!, index - 1, gapChunks.length).id}`],
            parallelStageIds:
                isLearningStage && gapChunks[index + 1]
                    ? [`stage.${index + 2}.${resolveTemplateForChunk(gapChunks[index + 1]!, index + 1, gapChunks.length).id}`]
                    : [],
            orderingReason:
                index === 0
                    ? "Start here; later stages build on this capability evidence."
                    : isLearningStage
                      ? "Requires the prior foundation, but its study work may run alongside the next stage."
                      : "Complete the prerequisite milestone first so you can demonstrate the expected skills and scope.",
            actionPlan: buildStageActionPlan({
                milestone: {
                    id: stageId,
                    label: stageLabel,
                    howToGetThere: fillPattern(template.descriptionPattern, shortFocusLabel(focus), params.dreamJob),
                    whatYouGain: stageOutcome,
                    whyItMatters: fillPattern(template.whyItMattersPattern, shortFocusLabel(focus), params.dreamJob),
                    targetRole: roleForStage,
                    progressionType: template.progressionType,
                    capabilityIds,
                    actions: actions.map((action) => action.title),
                    completionCriteria: [],
                    minMonths,
                    maxMonths,
                },
                user: userContext,
                dreamJob: params.dreamJob,
                resourceUrls: resources.map((resource) => resource.url),
            }),
        };
    });
};
