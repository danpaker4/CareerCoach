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
