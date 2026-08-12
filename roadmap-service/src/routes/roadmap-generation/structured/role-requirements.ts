import { normalizeCapabilityText } from "../catalog/capability-normalization";
import {
    EXECUTIVE_CYBER_LADDER,
    EXECUTIVE_LADDER,
    resolveRoleArchetype,
} from "../catalog/role-archetype.consts";
import {
    cleanMarketRequirementTexts,
    mapRequirementClassToCapabilityCategory,
} from "../cleaning/market-requirement-cleaner";
import type { RejectedRequirement } from "../cleaning/market-requirement-cleaner.types";
import {
    RECENCY_DEFAULT,
    REQUIREMENT_STRENGTH,
    SOURCE_CONFIDENCE,
} from "../scoring/roadmap-scoring.consts";
import { computeMarketImportance } from "../scoring/roadmap-scoring";
import type { MarketRequirementsContext } from "../gap-analysis.types";
import type { RoleRequirement } from "./structured-gap.types";

export type RoleRequirementsBuildResult = {
    readonly requirements: readonly RoleRequirement[];
    readonly removedInputs: readonly RejectedRequirement[];
};

export const buildRoleRequirements = (params: {
    readonly market: MarketRequirementsContext | null;
    readonly dreamJob: string;
    readonly pathSkills?: readonly string[];
}): RoleRequirementsBuildResult => {
    const market = params.market;
    const archetype = resolveRoleArchetype(params.dreamJob);
    const requirements = new Map<string, RoleRequirement>();
    const removedInputs: RejectedRequirement[] = [];

    const upsert = (requirement: RoleRequirement): void => {
        const existing = requirements.get(requirement.capabilityId);
        if (!existing) {
            requirements.set(requirement.capabilityId, requirement);
            return;
        }
        if (requirement.marketImportance > existing.marketImportance) {
            requirements.set(requirement.capabilityId, {
                ...requirement,
                reasonCodes: [...new Set([...existing.reasonCodes, ...requirement.reasonCodes])],
            });
            return;
        }
        requirements.set(requirement.capabilityId, {
            ...existing,
            reasonCodes: [...new Set([...existing.reasonCodes, ...requirement.reasonCodes])],
        });
    };

    const ingestTexts = (
        texts: readonly string[],
        frequencyBase: number,
        strength: number,
        sourceConfidence: number,
        reasonCode: string
    ): void => {
        const cleaned = cleanMarketRequirementTexts(texts);
        removedInputs.push(...cleaned.removed);
        const total = Math.max(1, cleaned.kept.length);
        for (const [index, item] of cleaned.kept.entries()) {
            if (item.classification === "PERSONAL_TRAIT") continue;
            // Education/certification are optional signals, not stage skill dumps.
            const importanceScale =
                item.classification === "EDUCATION" || item.classification === "CERTIFICATION" ? 0.45 : 1;
            const frequency = frequencyBase * ((total - index) / total) * importanceScale;
            const marketImportance = computeMarketImportance({
                frequency,
                requirementStrength: strength,
                recency: RECENCY_DEFAULT,
                sourceConfidence,
            });
            const category = mapRequirementClassToCapabilityCategory(item.classification);
            upsert({
                capabilityId: item.capabilityId,
                label: item.normalizedName,
                category,
                requiredLevel:
                    item.classification === "EDUCATION" || item.classification === "CERTIFICATION"
                        ? 2
                        : strength >= REQUIREMENT_STRENGTH.mustHave
                          ? 3
                          : 2,
                marketImportance,
                frequency,
                requirementStrength: strength,
                sourceConfidence,
                reasonCodes: [reasonCode, `class_${item.classification}`],
            });
        }
    };

    if (archetype === "executive_cyber" || archetype === "executive") {
        const ladder = archetype === "executive_cyber" ? EXECUTIVE_CYBER_LADDER : EXECUTIVE_LADDER;
        for (const rung of ladder) {
            upsert({
                capabilityId: rung.capabilityId,
                label: rung.label,
                category: rung.category,
                requiredLevel: rung.requiredLevel,
                marketImportance: computeMarketImportance({
                    frequency: 1.25 * rung.transitionRelevance,
                    requirementStrength: REQUIREMENT_STRENGTH.mustHave,
                    recency: RECENCY_DEFAULT,
                    sourceConfidence: SOURCE_CONFIDENCE.roleKnowledge,
                }),
                frequency: 1.25,
                requirementStrength: REQUIREMENT_STRENGTH.mustHave,
                sourceConfidence: SOURCE_CONFIDENCE.roleKnowledge,
                reasonCodes: [rung.reasonCode, "HIGH_TRANSITION_RELEVANCE"],
            });
        }
    }

    ingestTexts(
        [...(market?.commonSkills ?? []), ...(params.pathSkills ?? [])],
        market ? 0.65 : 0.4,
        REQUIREMENT_STRENGTH.shouldHave,
        market ? SOURCE_CONFIDENCE.marketJobs : SOURCE_CONFIDENCE.roleKnowledge,
        market ? "HIGH_MARKET_FREQUENCY" : "role_knowledge_skill"
    );
    ingestTexts(
        market?.responsibilities ?? [],
        0.5,
        REQUIREMENT_STRENGTH.shouldHave,
        SOURCE_CONFIDENCE.marketJobs,
        "market_responsibility"
    );
    ingestTexts(
        market?.leadershipSignals ?? [],
        0.5,
        REQUIREMENT_STRENGTH.shouldHave,
        SOURCE_CONFIDENCE.marketJobs,
        "market_leadership"
    );
    ingestTexts(
        market?.architectureSignals ?? [],
        0.5,
        REQUIREMENT_STRENGTH.shouldHave,
        SOURCE_CONFIDENCE.marketJobs,
        "market_architecture"
    );

    if (requirements.size === 0) {
        const fallback = normalizeCapabilityText("Professional communication");
        upsert({
            capabilityId: fallback.id,
            label: fallback.label,
            category: "soft",
            requiredLevel: 2,
            marketImportance: 0.4,
            frequency: 0.4,
            requirementStrength: REQUIREMENT_STRENGTH.shouldHave,
            sourceConfidence: SOURCE_CONFIDENCE.inferred,
            reasonCodes: ["sparse_market_fallback"],
        });
    }

    return {
        requirements: [...requirements.values()].sort((a, b) => b.marketImportance - a.marketImportance),
        removedInputs,
    };
};
