import type { GapAnalysisSnapshot } from "../gap-analysis.types";
import { getCapabilityDependencies } from "../catalog/capability-normalization";
import { computeGapScore, computePriorityScore } from "../scoring/roadmap-scoring";
import type {
    CapabilityGap,
    RoleRequirement,
    StructuredGapAnalysis,
    UserCapability,
} from "./structured-gap.types";
import { buildRoleRequirements } from "./role-requirements";
import { buildUserCapabilities } from "./user-capabilities";
import type { MarketRequirementsContext, UserCareerContext } from "../gap-analysis.types";

const dependencyWeightFor = (capabilityId: string): number => {
    const deps = getCapabilityDependencies(capabilityId);
    return 1 + deps.length * 0.15;
};

export const buildScoredGaps = (params: {
    readonly roleRequirements: readonly RoleRequirement[];
    readonly userCapabilities: readonly UserCapability[];
    readonly transitionRelevanceByCapabilityId?: ReadonlyMap<string, number>;
}): CapabilityGap[] => {
    const userById = new Map(params.userCapabilities.map((capability) => [capability.capabilityId, capability]));
    const gaps: CapabilityGap[] = [];

    for (const requirement of params.roleRequirements) {
        const userCapability = userById.get(requirement.capabilityId);
        const currentLevel = userCapability?.currentLevel ?? 0;
        const gapScore = computeGapScore({
            requiredLevel: requirement.requiredLevel,
            currentLevel,
        });
        if (gapScore <= 0) continue;

        const transitionRelevance =
            params.transitionRelevanceByCapabilityId?.get(requirement.capabilityId) ??
            (requirement.reasonCodes.some((code) => code.startsWith("archetype_")) ? 1.35 : 1);
        const dependencyWeight = dependencyWeightFor(requirement.capabilityId);
        const confidence = userCapability?.confidence ?? requirement.sourceConfidence;
        const priorityScore = computePriorityScore({
            gapScore,
            marketImportance: requirement.marketImportance,
            transitionRelevance,
            dependencyWeight,
            confidence,
        });

        gaps.push({
            gapId: `gap.${requirement.capabilityId}`,
            capabilityId: requirement.capabilityId,
            label: requirement.label,
            category: requirement.category,
            requiredLevel: requirement.requiredLevel,
            currentLevel,
            gapScore,
            marketImportance: requirement.marketImportance,
            transitionRelevance,
            dependencyWeight,
            confidence,
            priorityScore,
            reasonCodes: [...requirement.reasonCodes, "scored_gap"],
        });
    }

    return gaps.sort((a, b) => b.priorityScore - a.priorityScore);
};

export const projectLegacyGapAnalysis = (params: {
    readonly gaps: readonly CapabilityGap[];
    readonly user: UserCareerContext;
    readonly dreamJob: string;
}): GapAnalysisSnapshot => {
    const skillsPresent = params.user.userSkills.slice(0, 20);
    const skillsMissing = params.gaps
        .filter((gap) => gap.category === "technical" || gap.category === "domain")
        .map((gap) => gap.label)
        .slice(0, 8);
    const responsibilitiesMissing = params.gaps
        .filter((gap) => gap.category === "responsibility")
        .map((gap) => gap.label)
        .slice(0, 6);
    const leadershipGaps = params.gaps
        .filter((gap) => gap.category === "leadership")
        .map((gap) => gap.label)
        .slice(0, 6);
    const architectureGaps = params.gaps
        .filter((gap) => gap.category === "architecture")
        .map((gap) => gap.label)
        .slice(0, 6);
    const domainGaps = params.gaps
        .filter((gap) => gap.category === "domain")
        .map((gap) => gap.label)
        .slice(0, 6);
    const experienceGaps = params.gaps.filter((gap) => gap.category === "experience");

    return {
        skillsPresent,
        skillsMissing,
        responsibilitiesMissing,
        leadershipGaps,
        architectureGaps,
        domainGaps,
        experienceGapSummary:
            experienceGaps.length > 0
                ? "Build sustained evidence across increasingly senior roles over multiple years."
                : params.user.isEntryLevel
                  ? "Entry-level path: build portfolio evidence before professional experience stages."
                  : `Progress from ${params.user.roleExperienceLevel} toward ${params.dreamJob}.`,
    };
};

export const buildStructuredGapAnalysis = (params: {
    readonly user: UserCareerContext;
    readonly market: MarketRequirementsContext | null;
    readonly dreamJob: string;
    readonly pathSkills?: readonly string[];
    readonly transitionRelevanceByCapabilityId?: ReadonlyMap<string, number>;
}): StructuredGapAnalysis & { removedInputs: ReturnType<typeof buildRoleRequirements>["removedInputs"] } => {
    const userCapabilities = buildUserCapabilities(params.user);
    const { requirements: roleRequirements, removedInputs } = buildRoleRequirements({
        market: params.market,
        dreamJob: params.dreamJob,
        pathSkills: params.pathSkills,
    });
    const gaps = buildScoredGaps({
        roleRequirements,
        userCapabilities,
        transitionRelevanceByCapabilityId: params.transitionRelevanceByCapabilityId,
    });
    return { gaps, roleRequirements, userCapabilities, removedInputs };
};
