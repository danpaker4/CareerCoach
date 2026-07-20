import type { RoleExperienceEntry, RoleSeniorityLevel } from "./role-experience.types";

const SENIORITY_RANK: Record<RoleSeniorityLevel, number> = {
    junior: 1,
    mid: 2,
    senior: 3,
    lead: 4,
};

const ROLE_SENIORITY_LEVELS: readonly RoleSeniorityLevel[] = ["junior", "mid", "senior", "lead"];
const ROLE_EXPERIENCE_SOURCES: readonly RoleExperienceEntry["source"][] = ["cv", "chat", "job_interaction", "llm_inference"];

const uniqueEvidence = (evidence: readonly string[]): string[] =>
    [...new Set(evidence.map((item) => item.trim()).filter((item) => item.length > 0))];

export const yearsToSeniorityLevel = (years: number): RoleSeniorityLevel => {
    if (years < 2) {
        return "junior";
    }
    if (years < 5) {
        return "mid";
    }
    if (years < 8) {
        return "senior";
    }
    return "lead";
};

export const parseRoleExperienceEntry = (value: unknown): RoleExperienceEntry | null => {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const record = value as Record<string, unknown>;
    const level = typeof record.level === "string" && ROLE_SENIORITY_LEVELS.includes(record.level as RoleSeniorityLevel)
        ? (record.level as RoleSeniorityLevel)
        : null;
    const source = typeof record.source === "string" && ROLE_EXPERIENCE_SOURCES.includes(record.source as RoleExperienceEntry["source"])
        ? (record.source as RoleExperienceEntry["source"])
        : "llm_inference";
    const years = typeof record.years === "number" && Number.isFinite(record.years) ? Math.max(0, record.years) : null;

    if (
        typeof record.roleKey !== "string"
        || record.roleKey.trim().length === 0
        || typeof record.displayLabel !== "string"
        || record.displayLabel.trim().length === 0
        || level === null
        || years === null
    ) {
        return null;
    }

    const evidence = Array.isArray(record.evidence)
        ? record.evidence.filter((item): item is string => typeof item === "string")
        : [];
    const updatedAt = record.updatedAt instanceof Date
        ? record.updatedAt
        : typeof record.updatedAt === "string"
            ? new Date(record.updatedAt)
            : new Date();

    return {
        roleKey: record.roleKey.trim(),
        displayLabel: record.displayLabel.trim(),
        years,
        level,
        evidence: uniqueEvidence(evidence),
        source,
        updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
    };
};

export const readUserRoleExperienceField = (profile: Record<string, unknown>): RoleExperienceEntry[] =>
    Array.isArray(profile.roleExperience)
        ? profile.roleExperience
            .map(parseRoleExperienceEntry)
            .filter((entry): entry is RoleExperienceEntry => entry !== null)
        : [];

export const mergeRoleExperience = (
    existing: readonly RoleExperienceEntry[],
    incoming: readonly RoleExperienceEntry[]
): RoleExperienceEntry[] => {
    const mergedByKey = new Map<string, RoleExperienceEntry>();
    for (const entry of existing) {
        mergedByKey.set(entry.roleKey, {
            ...entry,
            evidence: uniqueEvidence(entry.evidence),
        });
    }

    for (const entry of incoming) {
        const previous = mergedByKey.get(entry.roleKey);
        const normalizedIncoming: RoleExperienceEntry = {
            ...entry,
            evidence: uniqueEvidence(entry.evidence),
            updatedAt: new Date(),
        };

        if (!previous) {
            mergedByKey.set(entry.roleKey, normalizedIncoming);
            continue;
        }

        const incomingRank = SENIORITY_RANK[normalizedIncoming.level];
        const previousRank = SENIORITY_RANK[previous.level];
        const preferIncoming =
            normalizedIncoming.years > previous.years
            || (normalizedIncoming.years === previous.years && incomingRank > previousRank);

        mergedByKey.set(entry.roleKey, preferIncoming
            ? {
                ...normalizedIncoming,
                years: Math.max(previous.years, normalizedIncoming.years),
                level:
                    normalizedIncoming.years > previous.years
                        ? normalizedIncoming.level
                        : incomingRank >= previousRank
                            ? normalizedIncoming.level
                            : previous.level,
                evidence: uniqueEvidence([...previous.evidence, ...normalizedIncoming.evidence]),
            }
            : {
                ...previous,
                years: Math.max(previous.years, normalizedIncoming.years),
                evidence: uniqueEvidence([...previous.evidence, ...normalizedIncoming.evidence]),
                updatedAt: new Date(),
            });
    }

    return [...mergedByKey.values()];
};
