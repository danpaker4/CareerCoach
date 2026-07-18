import type { RoleExperienceEntry, RoleSeniorityLevel } from "../../../../routes/external-chat-tools/role-experience.types";
import { yearsToSeniorityLevel } from "../../../../routes/external-chat-tools/role-experience.utils";
import type { RoleDomainDefinition } from "./seniority-inference.types";
import { ROLE_DOMAIN_DEFINITIONS } from "./seniority-inference.consts";
import type { InferredRoleExperience } from "./seniority-inference.types";

const YEAR_IN_CONTEXT_PATTERN = /(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+experience)?/gi;
const CAREER_SWITCH_PATTERN =
    /(?:want to|hope to|looking to|switch(?:ing)? to|move into|become|start(?:ing)? as|new to|interested in|exploring)\s+(?:being\s+(?:a\s+)?)?/gi;
const EXPLICIT_LEVEL_PATTERN = /\b(junior|mid(?:-|\s)?level|senior|lead|principal|staff)\b/gi;

const CONTEXT_WINDOW_CHARS = 120;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const resolveRoleDomainFromText = (text: string): RoleDomainDefinition | null => {
    const lowered = text.toLowerCase();
    const matches = ROLE_DOMAIN_DEFINITIONS
        .map((domain) => {
            const alias = domain.messageAliases.find((candidate) => lowered.includes(candidate));
            return alias ? { domain, aliasLength: alias.length } : null;
        })
        .filter((item): item is { domain: RoleDomainDefinition; aliasLength: number } => item !== null);

    if (matches.length === 0) {
        return null;
    }

    return matches.sort((left, right) => right.aliasLength - left.aliasLength)[0]?.domain ?? null;
};

const parseExplicitLevel = (text: string): RoleSeniorityLevel | null => {
    const lowered = text.toLowerCase();
    if (lowered.includes("junior") || lowered.includes("entry level") || lowered.includes("entry-level")) {
        return "junior";
    }
    if (lowered.includes("principal") || lowered.includes("staff") || lowered.includes("lead")) {
        return "lead";
    }
    if (lowered.includes("senior") || /\bsr\b/.test(lowered)) {
        return "senior";
    }
    if (lowered.includes("mid")) {
        return "mid";
    }
    return null;
};

const levelToMinimumYears = (level: RoleSeniorityLevel): number => {
    if (level === "junior") {
        return 0;
    }
    if (level === "mid") {
        return 2;
    }
    if (level === "senior") {
        return 5;
    }
    return 8;
};

const mergeEntry = (
    entriesByKey: Map<string, InferredRoleExperience>,
    candidate: InferredRoleExperience
): void => {
    const existing = entriesByKey.get(candidate.roleKey);
    if (!existing) {
        entriesByKey.set(candidate.roleKey, candidate);
        return;
    }

    const years = Math.max(existing.years, candidate.years);
    const explicitLevel = parseExplicitLevel(candidate.evidence) ?? parseExplicitLevel(existing.evidence);
    const levelFromYears = yearsToSeniorityLevel(years);
    const levelRank: Record<RoleSeniorityLevel, number> = { junior: 1, mid: 2, senior: 3, lead: 4 };
    const preferredLevel = explicitLevel && levelRank[explicitLevel] > levelRank[levelFromYears]
        ? explicitLevel
        : levelFromYears;

    entriesByKey.set(candidate.roleKey, {
        roleKey: candidate.roleKey,
        displayLabel: candidate.displayLabel,
        years,
        level: levelRank[preferredLevel] >= levelRank[existing.level] ? preferredLevel : existing.level,
        evidence: normalizeWhitespace(`${existing.evidence} ${candidate.evidence}`),
    });
};

const addInferredEntry = (
    entriesByKey: Map<string, InferredRoleExperience>,
    params: { domain: RoleDomainDefinition; years: number; level: RoleSeniorityLevel | null; evidence: string }
): void => {
    const years = Math.max(0, params.years);
    const explicitLevel = params.level ?? parseExplicitLevel(params.evidence);
    const level = explicitLevel ?? yearsToSeniorityLevel(years);
    const adjustedYears = Math.max(years, levelToMinimumYears(level));

    mergeEntry(entriesByKey, {
        roleKey: params.domain.roleKey,
        displayLabel: params.domain.displayLabel,
        years: adjustedYears,
        level,
        evidence: params.evidence,
    });
};

const inferFromYearMentions = (message: string, entriesByKey: Map<string, InferredRoleExperience>): void => {
    for (const match of message.matchAll(YEAR_IN_CONTEXT_PATTERN)) {
        const years = Number.parseInt(match[1] ?? "0", 10);
        if (!Number.isFinite(years) || years <= 0) {
            continue;
        }

        const start = Math.max(0, (match.index ?? 0) - CONTEXT_WINDOW_CHARS);
        const end = Math.min(message.length, (match.index ?? 0) + match[0].length + CONTEXT_WINDOW_CHARS);
        const context = message.slice(start, end);
        const domain = resolveRoleDomainFromText(context);
        if (!domain) {
            continue;
        }

        addInferredEntry(entriesByKey, {
            domain,
            years,
            level: parseExplicitLevel(context),
            evidence: normalizeWhitespace(context),
        });
    }
};

const inferFromCareerSwitch = (message: string, entriesByKey: Map<string, InferredRoleExperience>): void => {
    for (const match of message.matchAll(CAREER_SWITCH_PATTERN)) {
        const start = match.index ?? 0;
        const tail = message.slice(start, Math.min(message.length, start + CONTEXT_WINDOW_CHARS));
        const domain = resolveRoleDomainFromText(tail);
        if (!domain) {
            continue;
        }

        addInferredEntry(entriesByKey, {
            domain,
            years: 0,
            level: "junior",
            evidence: normalizeWhitespace(tail),
        });
    }
};

const inferFromExplicitRoleMentions = (message: string, entriesByKey: Map<string, InferredRoleExperience>): void => {
    for (const domain of ROLE_DOMAIN_DEFINITIONS) {
        const alias = domain.messageAliases.find((candidate) => message.toLowerCase().includes(candidate));
        if (!alias) {
            continue;
        }

        const aliasIndex = message.toLowerCase().indexOf(alias);
        const start = Math.max(0, aliasIndex - CONTEXT_WINDOW_CHARS);
        const end = Math.min(message.length, aliasIndex + alias.length + CONTEXT_WINDOW_CHARS);
        const context = message.slice(start, end);
        const explicitLevel = parseExplicitLevel(context);
        if (!explicitLevel) {
            continue;
        }

        addInferredEntry(entriesByKey, {
            domain,
            years: levelToMinimumYears(explicitLevel),
            level: explicitLevel,
            evidence: normalizeWhitespace(context),
        });
    }
};

export const inferRoleExperienceFromMessage = (message: string): InferredRoleExperience[] => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return [];
    }

    const entriesByKey = new Map<string, InferredRoleExperience>();
    inferFromYearMentions(trimmed, entriesByKey);
    inferFromCareerSwitch(trimmed, entriesByKey);
    inferFromExplicitRoleMentions(trimmed, entriesByKey);

    for (const match of trimmed.matchAll(EXPLICIT_LEVEL_PATTERN)) {
        const start = Math.max(0, (match.index ?? 0) - CONTEXT_WINDOW_CHARS);
        const end = Math.min(trimmed.length, (match.index ?? 0) + match[0].length + CONTEXT_WINDOW_CHARS);
        const context = trimmed.slice(start, end);
        const domain = resolveRoleDomainFromText(context);
        const explicitLevel = parseExplicitLevel(match[0]);
        if (!domain || !explicitLevel) {
            continue;
        }

        addInferredEntry(entriesByKey, {
            domain,
            years: levelToMinimumYears(explicitLevel),
            level: explicitLevel,
            evidence: normalizeWhitespace(context),
        });
    }

    return [...entriesByKey.values()];
};

export const resolveJobRoleKeyFromTitle = (jobTitle: string): string | null => {
    const lowered = jobTitle.toLowerCase();
    const matches = ROLE_DOMAIN_DEFINITIONS
        .map((domain) => {
            const keyword = domain.jobTitleKeywords.find((candidate) => lowered.includes(candidate));
            return keyword ? { domain, keywordLength: keyword.length } : null;
        })
        .filter((item): item is { domain: RoleDomainDefinition; keywordLength: number } => item !== null);

    return matches.sort((left, right) => right.keywordLength - left.keywordLength)[0]?.domain.roleKey ?? null;
};

export const parseJobSeniorityLevel = (seniority: string): RoleSeniorityLevel | null => {
    const lowered = seniority.toLowerCase();
    if (lowered.includes("intern") || lowered.includes("entry") || lowered.includes("junior") || lowered.includes("graduate")) {
        return "junior";
    }
    if (lowered.includes("principal") || lowered.includes("staff") || lowered.includes("lead") || lowered.includes("director")) {
        return "lead";
    }
    if (lowered.includes("senior") || /\bsr\b/.test(lowered)) {
        return "senior";
    }
    if (lowered.includes("mid") || lowered.includes("intermediate")) {
        return "mid";
    }
    return null;
};

const SENIORITY_RANK: Record<RoleSeniorityLevel, number> = {
    junior: 1,
    mid: 2,
    senior: 3,
    lead: 4,
};

/** Drops jobs that are too junior for the user's experience in the same role family. */
export const isJobSeniorityCompatibleWithRoleExperience = (
    roleExperience: readonly { roleKey: string; years: number; level: RoleSeniorityLevel }[],
    job: { title: string; seniority: string }
): boolean => {
    const jobRoleKey = resolveJobRoleKeyFromTitle(job.title);
    const jobLevel = parseJobSeniorityLevel(job.seniority);
    if (!jobRoleKey || !jobLevel || jobLevel !== "junior") {
        return true;
    }

    const userExperience = roleExperience.find((entry) => entry.roleKey === jobRoleKey);
    if (!userExperience) {
        return true;
    }

    const userRank = SENIORITY_RANK[userExperience.level];
    if (userRank >= 3) {
        return false;
    }

    if (userRank >= 2 && userExperience.years >= 4) {
        return false;
    }

    return userExperience.years < 3;
};

export const toRoleExperienceEntryFromInferred = (inferred: InferredRoleExperience): RoleExperienceEntry => ({
    roleKey: inferred.roleKey,
    displayLabel: inferred.displayLabel,
    years: inferred.years,
    level: inferred.level,
    evidence: [inferred.evidence],
    source: "llm_inference",
    updatedAt: new Date(),
});
