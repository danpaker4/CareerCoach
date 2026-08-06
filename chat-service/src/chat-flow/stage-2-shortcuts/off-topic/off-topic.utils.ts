import {
    CAREER_CONTEXT_PATTERN,
    CLEAR_OFF_TOPIC_PATTERNS,
    PROMPT_OVERRIDE_PATTERNS,
} from "./off-topic.consts";

const matchesAny = (message: string, patterns: readonly RegExp[]): boolean =>
    patterns.some((pattern) => pattern.test(message));

export const isClearlyOffTopic = (message: string): boolean => {
    const normalizedMessage = message.trim();
    if (normalizedMessage.length === 0) {
        return false;
    }
    if (matchesAny(normalizedMessage, PROMPT_OVERRIDE_PATTERNS)) {
        return true;
    }
    if (CAREER_CONTEXT_PATTERN.test(normalizedMessage)) {
        return false;
    }
    return matchesAny(normalizedMessage, CLEAR_OFF_TOPIC_PATTERNS);
};
