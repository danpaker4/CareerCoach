import { CONVERSATION_MODE } from "./conversation-mode.consts";
import {
    DREAM_JOB_PIVOT_PATTERNS,
    NEAR_TERM_PIVOT_PATTERNS,
    UNDECIDED_DIRECTION_PATTERNS,
} from "./conversation-mode.pivot.consts";
import type { ConversationModeDetectionResult } from "./conversation-mode.types";

export const isUndecidedDirectionMessage = (message: string): boolean => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return false;
    }
    return UNDECIDED_DIRECTION_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export const isDreamJobPivotMessage = (message: string): boolean => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return false;
    }
    if (isUndecidedDirectionMessage(trimmed)) {
        return false;
    }
    return DREAM_JOB_PIVOT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export const isNearTermPivotMessage = (message: string): boolean => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return false;
    }
    if (isUndecidedDirectionMessage(trimmed) || isDreamJobPivotMessage(trimmed)) {
        return false;
    }
    return NEAR_TERM_PIVOT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export const extractNearTermSearchQuery = (message: string): string | undefined => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return undefined;

    const asRole = trimmed.match(/\bas\s+(?:a\s+|an\s+)?([^.,!?\n]{3,80})/i);
    if (asRole?.[1]) {
        return asRole[1].trim().replace(/\s+now\b/i, "").trim();
    }

    const forRole = trimmed.match(
        /\b(?:looking|searching|hunting)\s+for\s+(?:a\s+|an\s+)?(?:new\s+)?(?:job|role|position)\s+(?:as\s+)?(?:a\s+|an\s+)?([^.,!?\n]{3,80})/i,
    );
    if (forRole?.[1] && !/^(?:now|soon|asap|right now)\b/i.test(forRole[1].trim())) {
        return forRole[1].trim().replace(/\s+now\b/i, "").trim();
    }

    const showOrFindForRole = trimmed.match(
        /\b(?:show|find)\s+(?:me\s+)?(?:a\s+)?(?:job|role|position)s?\s+for\s+(?:(?:a|an)\s+)?([^.,!?\n]{3,80})/i,
    );
    if (showOrFindForRole?.[1]) {
        return showOrFindForRole[1].trim().replace(/\s+now\b/i, "").trim();
    }

    return undefined;
};

export const applyDreamJobPivotOverride = (
    modeDetection: ConversationModeDetectionResult,
    latestUserMessage: string,
): ConversationModeDetectionResult => {
    if (!isDreamJobPivotMessage(latestUserMessage)) {
        return modeDetection;
    }
    if (modeDetection.mode === CONVERSATION_MODE.DREAMJOB) {
        return modeDetection;
    }
    return {
        ...modeDetection,
        mode: CONVERSATION_MODE.DREAMJOB,
        isReady: false,
        readinessScore: 0,
        shouldSearchJobs: false,
        searchQuery: undefined,
        missingInformation: ["dream job title"],
    };
};

export const applyNearTermPivotOverride = (
    modeDetection: ConversationModeDetectionResult,
    latestUserMessage: string,
): ConversationModeDetectionResult => {
    if (!isNearTermPivotMessage(latestUserMessage)) {
        return modeDetection;
    }

    const searchQuery =
        extractNearTermSearchQuery(latestUserMessage)
        ?? modeDetection.searchQuery;

    return {
        ...modeDetection,
        mode: CONVERSATION_MODE.NEAR_TERM,
        isReady: true,
        readinessScore: 100,
        shouldSearchJobs: true,
        searchQuery,
        missingInformation: [],
        dreamJobTitle: undefined,
    };
};

/** Near-term pivots win over dream-job pivots when both could apply. Undecided stays GUIDED. */
export const applyModePivotOverrides = (
    modeDetection: ConversationModeDetectionResult,
    latestUserMessage: string,
): ConversationModeDetectionResult => {
    if (isUndecidedDirectionMessage(latestUserMessage)) {
        return {
            ...modeDetection,
            mode: CONVERSATION_MODE.GUIDED,
            isReady: false,
            readinessScore: 0,
            shouldSearchJobs: false,
            searchQuery: undefined,
            dreamJobTitle: undefined,
        };
    }

    const withNearTerm = applyNearTermPivotOverride(modeDetection, latestUserMessage);
    if (withNearTerm.mode === CONVERSATION_MODE.NEAR_TERM && isNearTermPivotMessage(latestUserMessage)) {
        return withNearTerm;
    }
    return applyDreamJobPivotOverride(withNearTerm, latestUserMessage);
};
