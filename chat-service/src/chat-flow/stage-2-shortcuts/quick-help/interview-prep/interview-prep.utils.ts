const MIN_SUBSTANTIVE_ANSWER_CHARS = 12;

export const isInterviewAckMessage = (message: string): boolean => {
    const normalized = message.trim().toLowerCase();
    return (
        /\b(i\s+)?understand\b/i.test(normalized) ||
        /\b(got\s+it|makes\s+sense|clear|ok|okay|thanks)\b/i.test(normalized) ||
        /\bno\s+(more\s+)?questions?\b/i.test(normalized) ||
        normalized === "yes" ||
        normalized === "y"
    );
};

/** Obvious non-answers that should never be graded as correct. */
export const isClearlyInsufficientInterviewAnswer = (message: string): boolean => {
    const trimmed = message.trim();
    if (trimmed.length < MIN_SUBSTANTIVE_ANSWER_CHARS) {
        return true;
    }
    const normalized = trimmed.toLowerCase();
    return (
        /^(i\s+)?don'?t\s+know\.?$/i.test(normalized) ||
        /^(no\s+idea|idk|n\/a|na|none|nothing)\.?$/i.test(normalized) ||
        /^(test|asdf|qwerty|lorem ipsum)\.?$/i.test(normalized)
    );
};
