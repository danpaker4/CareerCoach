import type { SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";
import type { JobSelectionResolution } from "../../follow-up/job-follow-up-answer.types";

const BARE_ACCEPT_PATTERNS = [
    /^yes\.?$/i,
    /^sure\.?$/i,
    /^ok\.?$/i,
    /^okay\.?$/i,
    /^add it\.?$/i,
    /^add this\.?$/i,
    /^add that\.?$/i,
] as const;

const ORDINAL_LOOKUP: ReadonlyArray<{ patterns: readonly string[]; index: number }> = [
    { patterns: ["first", "1st"], index: 0 },
    { patterns: ["second", "2nd"], index: 1 },
    { patterns: ["third", "3rd"], index: 2 },
    { patterns: ["fourth", "4th"], index: 3 },
    { patterns: ["fifth", "5th"], index: 4 },
];

const normalizeMatchText = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9+#\s]/g, " ").replace(/\s+/g, " ").trim();

const stripCompanySuffixes = (company: string): string =>
    normalizeMatchText(company)
        .replace(/\b(?:ltd|limited|inc|incorporated|llc|corp|corporation|co)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const COMPANY_GENERIC_SUFFIX_TOKENS = new Set([
    "labs",
    "lab",
    "group",
    "technologies",
    "technology",
    "tech",
    "solutions",
    "software",
    "systems",
]);

export const companyMentionedInMessage = (company: string, message: string): boolean => {
    const messageNorm = normalizeMatchText(message);
    const companyNorm = normalizeMatchText(company);
    if (companyNorm.length === 0 || messageNorm.length === 0) {
        return false;
    }
    if (messageNorm.includes(companyNorm)) {
        return true;
    }
    const stripped = stripCompanySuffixes(company);
    if (stripped.length >= 3 && messageNorm.includes(stripped)) {
        return true;
    }
    const tokens = stripped.split(" ").filter((token) => token.length >= 3);
    const significantTokens = tokens.filter((token) => !COMPANY_GENERIC_SUFFIX_TOKENS.has(token));
    const tokensToMatch = significantTokens.length >= 2 ? significantTokens : tokens;
    return tokensToMatch.length >= 2 && tokensToMatch.every((token) => messageNorm.includes(token));
};

export const titleMentionedInMessage = (title: string, message: string): boolean => {
    const messageNorm = normalizeMatchText(message);
    const titleNorm = normalizeMatchText(title);
    if (titleNorm.length < 4 || messageNorm.length === 0) {
        return false;
    }
    if (messageNorm.includes(titleNorm)) {
        return true;
    }
    const significantTokens = titleNorm
        .split(" ")
        .filter((token) => token.length >= 4)
        .filter((token) => !["senior", "junior", "lead", "level", "with", "from"].includes(token));
    if (significantTokens.length === 0) {
        return false;
    }
    const matched = significantTokens.filter((token) => messageNorm.includes(token)).length;
    return matched >= Math.min(2, significantTokens.length);
};

const isBareAcceptMessage = (message: string): boolean =>
    BARE_ACCEPT_PATTERNS.some((pattern) => pattern.test(message.trim()));

export const resolvePipelineJobSelectionDeterministically = (
    userMessage: string,
    candidates: readonly SanitizedJob[],
    focusJobId: string | null,
): JobSelectionResolution => {
    if (candidates.length === 0) {
        return { status: "missing" };
    }
    if (candidates.length === 1) {
        const onlyJob = candidates[0];
        if (!onlyJob) {
            return { status: "missing" };
        }
        return { status: "resolved", job: onlyJob };
    }

    const normalized = normalizeMatchText(userMessage);
    const ordinalIndex = ORDINAL_LOOKUP.find(({ patterns }) =>
        patterns.some((pattern) => normalized.includes(pattern))
    )?.index;
    if (typeof ordinalIndex === "number" && ordinalIndex >= 0 && ordinalIndex < candidates.length) {
        const selectedByOrdinal = candidates[ordinalIndex];
        if (selectedByOrdinal) {
            return { status: "resolved", job: selectedByOrdinal };
        }
    }

    const byCompanyAndTitle = candidates.filter(
        (job) => companyMentionedInMessage(job.company, userMessage)
            && titleMentionedInMessage(job.title, userMessage),
    );
    if (byCompanyAndTitle.length === 1) {
        const match = byCompanyAndTitle[0];
        if (match) {
            return { status: "resolved", job: match };
        }
    }

    const byCompany = candidates.filter((job) => companyMentionedInMessage(job.company, userMessage));
    if (byCompany.length === 1) {
        const match = byCompany[0];
        if (match) {
            return { status: "resolved", job: match };
        }
    }

    const byTitle = candidates.filter((job) => titleMentionedInMessage(job.title, userMessage));
    if (byTitle.length === 1) {
        const match = byTitle[0];
        if (match) {
            return { status: "resolved", job: match };
        }
    }

    if (isBareAcceptMessage(userMessage) && focusJobId) {
        const focusJob = candidates.find((job) => job.id === focusJobId);
        if (focusJob) {
            return { status: "resolved", job: focusJob };
        }
    }

    return { status: "ambiguous", options: [...candidates] };
};
