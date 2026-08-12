import type { OnboardingBackground } from "../../../routes/conversation/conversation.types";
import { extractClaimedCurrentRole } from "../role-conflict/role-conflict.utils";
import { ONBOARDING_DIRECTION_REASK_REPLY } from "./onboarding.types";
import { resolveNormalizedChatRole } from "./onboarding.role-normalization.utils";

export type ChatStatedBackgroundFacts = {
    readonly role?: string;
    readonly yearsOfExperience?: number;
};

const YEAR_PATTERNS: readonly RegExp[] = [
    /\bin\s+the\s+last\s+(\d{1,2})\s+years?\b/i,
    /\bfor\s+(?:the\s+)?(?:last\s+)?(\d{1,2})\s+years?\b/i,
    /\b(\d{1,2})\s+years?\s+(?:of\s+)?(?:experience|exp)\b/i,
    /\b(\d{1,2})\s+years?\s+(?:as|in|doing)\b/i,
];

export const extractClaimedYearsOfExperience = (message: string): number | undefined => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return undefined;

    for (const pattern of YEAR_PATTERNS) {
        const match = trimmed.match(pattern);
        const raw = match?.[1];
        if (!raw) continue;
        const years = Number.parseInt(raw, 10);
        if (Number.isFinite(years) && years >= 0 && years <= 60) {
            return years;
        }
    }
    return undefined;
};

export const extractChatStatedBackgroundFacts = (message: string): ChatStatedBackgroundFacts => {
    const role = extractClaimedCurrentRole(message);
    const yearsOfExperience = extractClaimedYearsOfExperience(message);
    return {
        ...(role ? { role } : {}),
        ...(yearsOfExperience !== undefined ? { yearsOfExperience } : {}),
    };
};

export const formatChatStatedFactsForPrompt = (facts: ChatStatedBackgroundFacts): string => {
    const lines: string[] = [];
    if (facts.role) {
        lines.push(`role=${facts.role}`);
    }
    if (facts.yearsOfExperience !== undefined) {
        lines.push(`yearsOfExperience=${facts.yearsOfExperience}`);
    }
    if (lines.length === 0) {
        return "none";
    }
    return lines.join(", ");
};

export const buildChatStatedBackgroundReply = (facts: ChatStatedBackgroundFacts): string | null => {
    if (facts.role && facts.yearsOfExperience !== undefined) {
        return `Nice — you have about ${facts.yearsOfExperience} years of experience as a ${facts.role}. ${ONBOARDING_DIRECTION_REASK_REPLY}`;
    }
    if (facts.role) {
        return `Nice — ${facts.role}. ${ONBOARDING_DIRECTION_REASK_REPLY}`;
    }
    if (facts.yearsOfExperience !== undefined) {
        return `Nice — about ${facts.yearsOfExperience} years of experience. ${ONBOARDING_DIRECTION_REASK_REPLY}`;
    }
    return null;
};

const normalizeFactText = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();

export const doesReplyMatchChatStatedFacts = (reply: string, facts: ChatStatedBackgroundFacts): boolean => {
    const normalizedReply = ` ${normalizeFactText(reply)} `;
    const normalizedRole = facts.role ? normalizeFactText(facts.role) : null;
    const includesRole = normalizedRole === null || normalizedReply.includes(` ${normalizedRole} `);
    const mentionedYears = [...reply.matchAll(/\b(\d{1,2})\s+years?\b/gi)]
        .map((match) => Number.parseInt(match[1], 10));
    const includesOnlyAuthoritativeYears = facts.yearsOfExperience === undefined
        || (mentionedYears.includes(facts.yearsOfExperience)
            && mentionedYears.every((years) => years === facts.yearsOfExperience));

    return includesRole && includesOnlyAuthoritativeYears;
};

export const applyChatStatedFactsToBackground = (
    background: OnboardingBackground,
    facts: ChatStatedBackgroundFacts,
): OnboardingBackground => {
    if (!facts.role && facts.yearsOfExperience === undefined) {
        return background;
    }

    const role = facts.role
        ? resolveNormalizedChatRole(facts.role, background.role)
        : background.role ?? null;
    const yearsOfExperience = facts.yearsOfExperience ?? background.yearsOfExperience ?? null;
    const company = background.companies?.[0]?.trim();
    const companySuffix = company && company.length > 0 ? ` at ${company}` : "";

    const summary = role && yearsOfExperience !== null
        ? `${role} for about ${yearsOfExperience} years${companySuffix}`
        : role
            ? `${role}${companySuffix}`
            : background.summary ?? null;

    return {
        ...background,
        role,
        yearsOfExperience,
        summary,
    };
};
