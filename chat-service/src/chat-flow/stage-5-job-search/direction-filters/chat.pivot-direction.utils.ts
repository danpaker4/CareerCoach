/**
 * A user who rejects a shortlist often names the direction they actually want in the same breath:
 * "nothing from here, maybe QA". Treating that as a plain rejection loses the useful half of the
 * message, so the pivot is extracted and used to run a fresh search instead.
 */

/** Phrases that introduce a new direction after, or instead of, a rejection. */
const PIVOT_MARKERS: readonly RegExp[] = [
    /\bmaybe\s+(.{2,40})$/i,
    /\bwhat about\s+(.{2,40})$/i,
    /\bhow about\s+(.{2,40})$/i,
    /\b(?:i(?:'d| would)? )?(?:prefer|rather|want)\s+(.{2,40})$/i,
    /\binstead(?:,)?\s+(?:try\s+|show me\s+|find me\s+|look(?:ing)? for\s+)?(.{2,40})$/i,
    /\b(?:try|show me|find me|search for|look for)\s+(.{2,40})$/i,
];

/** Trailing noise that should not become part of the search query. */
const TRAILING_NOISE = /\b(jobs?|roles?|positions?|please|instead|now|thanks?)\b/gi;

const cleanDirection = (raw: string): string =>
    raw
        .replace(TRAILING_NOISE, " ")
        .replace(/[.,!?;:]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/**
 * Returns the new direction named in the message, or null when the message only rejects.
 * Kept deliberately conservative: a match must come from an explicit pivot phrase, so an
 * ordinary rejection ("none of these") never triggers a search the user did not ask for.
 */
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
        // Two characters is enough for real answers such as "QA" or "BI".
        if (direction.length >= 2 && direction.length <= 40) {
            return direction;
        }
    }

    return null;
};
