import {
    DREAM_JOB_TARGET_YEARS_MAX,
    DREAM_JOB_TARGET_YEARS_MIN,
} from "./chat.dream-job-roadmap.consts";

const AFFIRMATIVE_PATTERNS: readonly RegExp[] = [
    /^yes\b/i,
    /^yeah\b/i,
    /^yep\b/i,
    /^sure\b/i,
    /^correct\b/i,
    /^that's right\b/i,
    /^that is right\b/i,
    /^exactly\b/i,
    /^confirm\b/i,
    /^sounds good\b/i,
    /^perfect\b/i,
];

const NEGATIVE_PATTERNS: readonly RegExp[] = [
    /^no\b/i,
    /^nope\b/i,
    /^not really\b/i,
    /^incorrect\b/i,
    /^wrong\b/i,
    /^change\b/i,
    /^different\b/i,
];

export const isAffirmativeConfirmation = (message: string): boolean => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return false;
    }
    return AFFIRMATIVE_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export const isNegativeConfirmation = (message: string): boolean => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return false;
    }
    return NEGATIVE_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export const inferDreamJobTitleFromMessage = (message: string): string | undefined => {
    const normalized = message.toLowerCase();
    if (/\bfounder\b/.test(normalized) && (/\bstartup\b/.test(normalized) || /\bcompany\b/.test(normalized))) {
        return "Founder";
    }
    if (/\bchief technology officer\b|\bcto\b/.test(normalized)) {
        return "Chief Technology Officer";
    }
    if (/\bchief executive officer\b|\bceo\b/.test(normalized)) {
        return "Chief Executive Officer";
    }
    if (/\bproduct manager\b/.test(normalized)) {
        return "Product Manager";
    }
    return undefined;
};

export const normalizeDreamJobTitle = (title: string): string => {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
        return "";
    }
    return trimmed
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
};

const clampTargetYears = (years: number): number | undefined => {
    if (!Number.isFinite(years)) return undefined;
    const rounded = Math.round(years);
    if (rounded < DREAM_JOB_TARGET_YEARS_MIN || rounded > DREAM_JOB_TARGET_YEARS_MAX) {
        return undefined;
    }
    return rounded;
};

/** Parse "5", "in 5 years", "within 3 years", "about 10 yrs". */
export const parseTargetYearsFromMessage = (message: string): number | undefined => {
    const trimmed = message.trim().toLowerCase();
    if (trimmed.length === 0) return undefined;

    const patterns: readonly RegExp[] = [
        /(?:in|within|after|about|around|roughly)\s+(\d{1,2})\s*(?:years?|yrs?)\b/,
        /^(\d{1,2})\s*(?:years?|yrs?)?\s*$/,
        /\b(\d{1,2})\s*(?:years?|yrs?)\b/,
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (!match?.[1]) continue;
        const years = clampTargetYears(Number(match[1]));
        if (years !== undefined) return years;
    }
    return undefined;
};
