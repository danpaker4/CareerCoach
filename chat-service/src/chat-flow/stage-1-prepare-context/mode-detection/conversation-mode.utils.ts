import {
    CONVERSATION_MODE_VALUES,
    DREAMJOB_CHANGE_SIGNALS,
    DREAMJOB_SIGNALS,
    EXPLICIT_FAST_SEARCH_SIGNALS,
    TIMELINE_UNCERTAINTY_SIGNALS,
} from "./conversation-mode.consts";
import type { ConversationMode, DreamJobContextMessage } from "./conversation-mode.types";

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

const NEAR_TERM_HORIZON_PATTERN =
    /\b(?:short[\s-]?term|near[\s-]?term|asap|immediately|right away|right now|soon)\b/i;
const JOB_SEEKING_PATTERN =
    /\b(?:job|jobs|role|roles|position|positions|hire|hiring|employ|find|looking for|search|apply)\b/i;

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

export const hasExplicitFastSearchIntent = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return EXPLICIT_FAST_SEARCH_SIGNALS.some((signal) => normalized.includes(signal));
};

export const hasNearTermJobSearchIntent = (message: string): boolean => {
    if (hasExplicitFastSearchIntent(message)) {
        return true;
    }
    return NEAR_TERM_HORIZON_PATTERN.test(message) && JOB_SEEKING_PATTERN.test(message);
};

export const hasTimelineUncertaintyIntent = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return TIMELINE_UNCERTAINTY_SIGNALS.some((signal) => normalized.includes(signal));
};

/** Exit sticky DREAMJOB and coach via GUIDED (timeline / clarifying questions). */
export const shouldPreferGuidedOverDreamJob = (message: string): boolean =>
    hasTimelineUncertaintyIntent(message) ||
    (hasNearTermJobSearchIntent(message) && !hasExplicitFastSearchIntent(message));

export const shouldEnterDreamJobMode = (message: string, existingDreamJob: string | null): boolean => {
    if (hasExplicitFastSearchIntent(message) || shouldPreferGuidedOverDreamJob(message)) {
        return false;
    }
    if (hasDreamJobChangeIntent(message)) {
        return true;
    }
    if (existingDreamJob !== null && existingDreamJob.trim().length > 0) {
        return false;
    }
    return hasDreamJobIntent(message);
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

export const resolveConversationModeOverride = (params: {
    message: string;
    existingDreamJob: string | null;
    hasActiveDreamJobFlow: boolean;
    stickyDreamJobFromHistory: boolean;
    detectedMode: ConversationMode;
}): ConversationMode => {
    const { message, existingDreamJob, hasActiveDreamJobFlow, stickyDreamJobFromHistory, detectedMode } = params;

    if (hasExplicitFastSearchIntent(message)) {
        return "FAST_SEARCH";
    }
    if (shouldPreferGuidedOverDreamJob(message)) {
        return "GUIDED";
    }

    const isDreamJobRule =
        shouldEnterDreamJobMode(message, existingDreamJob) || hasActiveDreamJobFlow || stickyDreamJobFromHistory;

    if (isDreamJobRule) {
        return "DREAMJOB";
    }
    return detectedMode;
};
