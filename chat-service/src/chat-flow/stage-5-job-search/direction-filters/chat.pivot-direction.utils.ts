
const PIVOT_MARKERS: readonly RegExp[] = [
    /\bmaybe\s+(.{2,40})$/i,
    /\bwhat about\s+(.{2,40})$/i,
    /\bhow about\s+(.{2,40})$/i,
    /\b(?:i(?:'d| would)? )?(?:prefer|rather|want)\s+(.{2,40})$/i,
    /\binstead(?:,)?\s+(?:try\s+|show me\s+|find me\s+|look(?:ing)? for\s+)?(.{2,40})$/i,
    /\b(?:try|show me|find me|search for|look for)\s+(.{2,40})$/i,
];

const TRAILING_NOISE = /\b(jobs?|roles?|positions?|please|instead|now|thanks?)\b/gi;

const cleanDirection = (raw: string): string =>
    raw
        .replace(TRAILING_NOISE, " ")
        .replace(/[.,!?;:]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const extractPivotDirection = (message: string): string | null => {
    const normalized = message.trim();
    if (normalized.length === 0) {
        return null;
    }

    for (const pattern of PIVOT_MARKERS) {
        const match = normalized.match(pattern);
        if (!match?.[1]) {
            continue;
        }
        const direction = cleanDirection(match[1]);
        if (direction.length >= 2 && direction.length <= 40) {
            return direction;
        }
    }

    return null;
};
