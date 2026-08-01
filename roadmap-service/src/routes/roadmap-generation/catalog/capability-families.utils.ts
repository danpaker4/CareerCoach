import type { CapabilityGap } from "../structured/structured-gap.types";

export type CapabilityFamilyId =
    | "credential"
    | "programming"
    | "frontend"
    | "data_ml"
    | "cloud_infra"
    | "security"
    | "architecture"
    | "soft"
    | "leadership"
    | "experience"
    | "business"
    | "other";

type FamilyDefinition = {
    readonly id: CapabilityFamilyId;
    readonly focusLabel: string;
    readonly rank: number;
    readonly capabilityIds: readonly string[];
};

const FAMILY_DEFS: readonly FamilyDefinition[] = [
    {
        id: "credential",
        focusLabel: "CS education",
        rank: 0,
        capabilityIds: ["cap.credential.cs.degree"],
    },
    {
        id: "programming",
        focusLabel: "programming",
        rank: 1,
        capabilityIds: ["cap.programming.fundamentals", "cap.python", "cap.sql", "cap.javascript"],
    },
    {
        id: "frontend",
        focusLabel: "frontend engineering",
        rank: 2,
        capabilityIds: ["cap.typescript", "cap.react"],
    },
    {
        id: "data_ml",
        focusLabel: "data and machine learning",
        rank: 3,
        capabilityIds: ["cap.data.analysis", "cap.machine.learning"],
    },
    {
        id: "cloud_infra",
        focusLabel: "cloud and infrastructure",
        rank: 4,
        capabilityIds: ["cap.cloud.basics", "cap.devops.basics"],
    },
    {
        id: "security",
        focusLabel: "cybersecurity",
        rank: 5,
        capabilityIds: ["cap.cybersecurity", "cap.security.operations", "cap.security.architecture"],
    },
    {
        id: "architecture",
        focusLabel: "system architecture",
        rank: 6,
        capabilityIds: ["cap.system.design"],
    },
    {
        id: "soft",
        focusLabel: "professional communication",
        rank: 7,
        capabilityIds: ["cap.communication", "cap.collaboration"],
    },
    {
        id: "experience",
        focusLabel: "professional delivery",
        rank: 8,
        capabilityIds: ["cap.professional.experience", "cap.portfolio", "cap.project.ownership", "cap.interview.ready"],
    },
    {
        id: "leadership",
        focusLabel: "leadership",
        rank: 9,
        capabilityIds: ["cap.leadership", "cap.executive.leadership"],
    },
    {
        id: "business",
        focusLabel: "business fluency",
        rank: 10,
        capabilityIds: ["cap.product.sense", "cap.business.finance", "cap.domain.business"],
    },
];

const FAMILY_BY_CAPABILITY_ID = new Map<string, FamilyDefinition>(
    FAMILY_DEFS.flatMap((family) => family.capabilityIds.map((capabilityId) => [capabilityId, family] as const))
);

const DYNAMIC_FAMILY_RULES: readonly { readonly pattern: RegExp; readonly familyId: CapabilityFamilyId }[] = [
    { pattern: /\b(spark|kafka|flink|hadoop|data.?pipeline|etl|warehouse|statistics|statistical|experiment)\b/i, familyId: "data_ml" },
    { pattern: /\b(machine learning|deep learning|\bml\b|\bai\b|model training)\b/i, familyId: "data_ml" },
    { pattern: /\b(aws|gcp|azure|cloud|kubernetes|k8s|docker|devops|terraform|ci\/cd)\b/i, familyId: "cloud_infra" },
    { pattern: /\b(python|java|golang|go\b|c\+\+|rust|programming|coding)\b/i, familyId: "programming" },
    { pattern: /\b(react|frontend|typescript|javascript|ui)\b/i, familyId: "frontend" },
    { pattern: /\b(security|cyber|soc|threat|infosec)\b/i, familyId: "security" },
    { pattern: /\b(architect|system design|distributed)\b/i, familyId: "architecture" },
    { pattern: /\b(communicat|presentation|stakeholder|collaborat|soft skill)\b/i, familyId: "soft" },
    { pattern: /\b(lead|manage|mentor|executive)\b/i, familyId: "leadership" },
    { pattern: /\b(business|p&l|finance|product)\b/i, familyId: "business" },
];

const FAMILY_BY_ID = new Map(FAMILY_DEFS.map((family) => [family.id, family]));

export const resolveCapabilityFamily = (gap: Pick<CapabilityGap, "capabilityId" | "label" | "category">): FamilyDefinition => {
    const byId = FAMILY_BY_CAPABILITY_ID.get(gap.capabilityId);
    if (byId) return byId;

    const text = `${gap.capabilityId} ${gap.label}`;
    for (const rule of DYNAMIC_FAMILY_RULES) {
        if (rule.pattern.test(text)) {
            const family = FAMILY_BY_ID.get(rule.familyId);
            if (family) return family;
        }
    }

    if (gap.category === "soft") return FAMILY_BY_ID.get("soft")!;
    if (gap.category === "leadership") return FAMILY_BY_ID.get("leadership")!;
    if (gap.category === "experience" || gap.category === "responsibility") return FAMILY_BY_ID.get("experience")!;
    if (gap.category === "architecture") return FAMILY_BY_ID.get("architecture")!;
    if (gap.category === "credential") return FAMILY_BY_ID.get("credential")!;
    if (gap.category === "domain") return FAMILY_BY_ID.get("business")!;

    return {
        id: "other",
        focusLabel: gap.label,
        rank: 11,
        capabilityIds: [],
    };
};

export const resolveStageFocusLabel = (gaps: readonly CapabilityGap[]): string => {
    if (gaps.length === 0) return "core capabilities";
    if (gaps.length === 1) return gaps[0]!.label;

    const families = gaps.map((gap) => resolveCapabilityFamily(gap));
    const uniqueFamilyIds = [...new Set(families.map((family) => family.id))];
    if (uniqueFamilyIds.length === 1) {
        const family = families[0]!;
        if (family.id === "other") return gaps[0]!.label;
        return family.focusLabel;
    }

    return gaps[0]!.label;
};

export const familyRank = (gap: CapabilityGap): number => resolveCapabilityFamily(gap).rank;
