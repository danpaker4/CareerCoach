import type { OnboardingBackground } from "../../../routes/conversation/conversation.types";
import { ONBOARDING_DIRECTION_REASK_REPLY } from "./onboarding.types";
import { resolveNormalizedChatRole } from "./onboarding.role-normalization.utils";

export type ChatStatedBackgroundFacts = {
    readonly name?: string;
    readonly role?: string;
    readonly yearsOfExperience?: number;
};

const NAME_PATTERN = /\b(?:my\s+name\s+is|call\s+me)\s+([a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,3})/i;
const ROLE_PATTERNS: readonly RegExp[] = [
    /\b(?:i\s+am|i['’]?m|im)\s+(?:an?\s+)?([a-z][a-z0-9+#./&\-\s]{0,80})/i,
    /\b(?:i\s+work(?:ed)?\s+(?:as|in)|i(?:'ve|\s+have)\s+been\s+(?:working\s+)?as)\s+(?:an?\s+)?([a-z][a-z0-9+#./&\-\s]{0,80})/i,
    /\b\d{1,2}\s+years?\s+(?:as|in)\s+(?:an?\s+)?([a-z][a-z0-9+#./&\-\s]{0,80})/i,
];
const YEAR_PATTERNS: readonly RegExp[] = [
    /\bin\s+the\s+last\s+(\d{1,2})\s+years?\b/i,
    /\bfor\s+(?:the\s+)?(?:last\s+)?(\d{1,2})\s+years?\b/i,
    /\b(\d{1,2})\s+years?\s+(?:of\s+)?(?:experience|exp)\b/i,
    /\b(\d{1,2})\s+years?\s+(?:as|in|doing)\b/i,
];

const CHAT_ROLE_INTENT_PATTERN = /^(?:looking|searching|seeking|wanting|hoping|trying|interested|applying|planning|going|not)\b/i;
const CHAT_ROLE_TRAILING_INTENT_PATTERN = /\s+(?:and\s+)?(?:i\s+am\s+)?(?:looking|searching|seeking|wanting|hoping|trying|interested|applying|planning)\b.*$/i;
const CHAT_ROLE_TRAILING_TENURE_PATTERN = /\s+(?:for|since)\s+\d{1,2}\s+years?.*$/i;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const extractClaimedName = (message: string): string | undefined => {
    const candidate = NAME_PATTERN.exec(message)?.[1];
    if (!candidate) {
        return undefined;
    }

    const name = normalizeWhitespace(candidate)
        .replace(/\s+(?:and|but|i|in|for|with|as|at)\b.*$/i, "")
        .trim();
    return name.length > 0 ? name : undefined;
};

const normalizeClaimedRole = (value: string): string | undefined => {
    const role = normalizeWhitespace(value)
        .split(/[,.!?;]/, 1)[0]
        .replace(CHAT_ROLE_TRAILING_INTENT_PATTERN, "")
        .replace(CHAT_ROLE_TRAILING_TENURE_PATTERN, "")
        .trim();

    if (role.length === 0 || CHAT_ROLE_INTENT_PATTERN.test(role)) {
        return undefined;
    }
    return role;
};

export const extractClaimedRole = (message: string): string | undefined => {
    for (const pattern of ROLE_PATTERNS) {
        const candidate = pattern.exec(message)?.[1];
        if (!candidate) {
            continue;
        }

        const role = normalizeClaimedRole(candidate);
        if (role) {
            return role;
        }
    }
    return undefined;
};

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
    const name = extractClaimedName(message);
    const role = extractClaimedRole(message);
    const yearsOfExperience = extractClaimedYearsOfExperience(message);
    return {
        ...(name ? { name } : {}),
        ...(role ? { role } : {}),
        ...(yearsOfExperience !== undefined ? { yearsOfExperience } : {}),
    };
};

export const formatChatStatedFactsForPrompt = (facts: ChatStatedBackgroundFacts): string => {
    const lines: string[] = [];
    if (facts.name) {
        lines.push(`name=${facts.name}`);
    }
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
    if (facts.name && facts.role && facts.yearsOfExperience !== undefined) {
        return `Thanks, ${facts.name}. You have about ${facts.yearsOfExperience} years of experience as a ${facts.role}. ${ONBOARDING_DIRECTION_REASK_REPLY}`;
    }
    if (facts.name && facts.role) {
        return `Thanks, ${facts.name}. You are a ${facts.role}. ${ONBOARDING_DIRECTION_REASK_REPLY}`;
    }
    if (facts.name && facts.yearsOfExperience !== undefined) {
        return `Thanks, ${facts.name}. You have about ${facts.yearsOfExperience} years of experience. ${ONBOARDING_DIRECTION_REASK_REPLY}`;
    }
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
