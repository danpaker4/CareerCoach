import { CONVERSATION_MODE_VALUES, DREAMJOB_CHANGE_SIGNALS, DREAMJOB_SIGNALS } from "./conversation-mode.consts";
import type { ConversationMode } from "./conversation-mode.types";

export const isConversationMode = (value: unknown): value is ConversationMode =>
    typeof value === "string" && (CONVERSATION_MODE_VALUES as readonly string[]).includes(value);

const DREAMJOB_ASPIRATION_PATTERNS: readonly RegExp[] = [
    /\bi want to be (a )?founder\b/i,
    /\bfounder of (a )?(my )?startup\b/i,
    /\bstart(?:ing)? (?:my|a|own) (?:company|startup|business)\b/i,
    /\bbuild (?:my|a|own) (?:company|startup|business)\b/i,
    /\bsomething in the future\b/i,
    /\blooking for something in the future\b/i,
    /\blong[\s-]?term\b/i,
    /\bin the future\b/i,
    /\bdream (?:job|role|career)\b/i,
    /\bcareer aspiration\b/i,
    /\bwhere i see myself\b/i,
    /\bfuture (?:role|career|job|path)\b/i,
    /\bmy own (?:company|startup|business)\b/i,
];

export const hasDreamJobChangeIntent = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return DREAMJOB_CHANGE_SIGNALS.some((signal) => normalized.includes(signal));
};

export const hasDreamJobAspirationPattern = (message: string): boolean =>
    DREAMJOB_ASPIRATION_PATTERNS.some((pattern) => pattern.test(message));

export const hasDreamJobIntent = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return (
        DREAMJOB_SIGNALS.some((signal) => normalized.includes(signal)) || hasDreamJobAspirationPattern(message)
    );
};

export const shouldEnterDreamJobMode = (message: string, existingDreamJob: string | null): boolean => {
    if (hasDreamJobChangeIntent(message)) {
        return true;
    }
    if (existingDreamJob !== null && existingDreamJob.trim().length > 0) {
        return false;
    }
    return hasDreamJobIntent(message);
};

export type DreamJobContextMessage = {
    role: string;
    content: string;
};

export const conversationHasDreamJobContext = (
    messages: readonly DreamJobContextMessage[],
    lookback = 10
): boolean => {
    const recent = messages.slice(-lookback);
    const userStatedDreamIntent = recent
        .filter((message) => message.role === "user")
        .some((message) => hasDreamJobIntent(message.content));

    if (userStatedDreamIntent) {
        return true;
    }

    const assistantDreamJobDiscussion = /\bdream job\b|long[\s-]?term aspiration|future career|dream role/i;
    return recent
        .filter((message) => message.role === "assistant")
        .some((message) => assistantDreamJobDiscussion.test(message.content));
};
