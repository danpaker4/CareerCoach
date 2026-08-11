import type { ConversationMode } from "./conversation-mode.types";
import { CONVERSATION_MODE } from "./conversation-mode.consts";

export type DeterministicModeDetection = {
    readonly mode: ConversationMode;
    readonly target: string;
};

/** The role is named after the noun: "show me jobs for a devops engineer". */
const NEAR_TERM_TRAILING_TARGET: readonly RegExp[] = [
    /\b(?:find|show|get|send|list|search|skip)\w*\s+(?:me\s+)?(?:some\s+|to\s+|the\s+)?(?:jobs?|roles?|positions?|openings?|vacancies)\b\s*(?:now|today)?\s*(?:for|as|in)\s+(.+)/i,
    /\bsearch\s+now\s+for\s+(.+)/i,
    /\b(?:jobs?|roles?|positions?|openings?)\s+for\s+(.+)/i,
];

/** The role is named before the noun: "senior product manager roles please". */
const NEAR_TERM_LEADING_TARGET: readonly RegExp[] = [
    /\b(?:find|show|get|send)\s+me\s+(?:some\s+)?(.+?)\s+(?:jobs?|roles?|positions?|openings?)\b/i,
    /\bi(?:'d| would)?\s+(?:want|need|like)\s+(?:a|an)\s+(.+?)\s+(?:job|role|position)\b/i,
    /\b(?:looking|searching)\s+for\s+(?:a|an)?\s*(.+?)\s+(?:job|role|position)\b/i,
    /^(.+?)\s+(?:jobs?|roles?|positions?)\s+(?:please|now)\b/i,
];

const DREAM_JOB_PATTERNS: readonly RegExp[] = [
    /\bmy\s+dream\s+(?:job|role)?\s*(?:long[- ]term)?\s*is\s+(?:to\s+)?(?:be\s+|become\s+)?(?:a|an|the)?\s*(.+)/i,
    /\bmy\s+dream\s+is\s+to\s+(?:become|be|build)\s+(?:a|an|the)?\s*(.+)/i,
    /\bwhere\s+i\s+want\s+to\s+be\s+in\s+\d+\s+years?\s+is\s+(.+)/i,
    /\bi\s+want\s+to\s+(?:become|be)\s+(?:a|an|the)?\s*(.+?)(?:\s+in\s+\d+\s+years?)?[.!?]*$/i,
    /\b(?:long[- ]term|eventually|one\s+day),?\s+i\s+(?:want|would like)\s+to\s+(?:become|be|build)\s+(?:a|an)?\s*(.+)/i,
    /\bi\s+(?:aspire|aim)\s+to\s+(?:become|be)\s+(?:a|an)?\s*(.+)/i,
];

const NOISE = /\b(?:please|now|today|asap|right\s+now|for\s+me|some|any)\b/gi;
const LEADING_ARTICLE = /^(?:a|an|the)\s+/i;
const TRAILING_FILLER = /\b(?:jobs?|roles?|positions?|openings?|vacancies)\b\s*$/i;

const cleanTarget = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    const cleaned = raw
        .replace(NOISE, " ")
        .replace(/[.,!?;:]+/g, " ")
        .replace(TRAILING_FILLER, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(LEADING_ARTICLE, "");
    return cleaned.length >= 2 && cleaned.length <= 80 ? cleaned : undefined;
};

const firstTarget = (message: string, patterns: readonly RegExp[]): string | undefined => {
    for (const pattern of patterns) {
        const target = cleanTarget(message.match(pattern)?.[1]);
        if (target) return target;
    }
    return undefined;
};

/**
 * Recognises the intents a user states outright, so an explicit request does not depend on a small
 * model classifying it correctly. Both modes require a target: a message that asks for work without
 * naming what kind ("i need to change jobs") is genuinely under-specified and belongs in the guided
 * flow, so it is left to the model.
 */
export const detectModeDeterministically = (message: string): DeterministicModeDetection | null => {
    const normalized = message.trim();
    if (normalized.length === 0) return null;

    const dreamTarget = firstTarget(normalized, DREAM_JOB_PATTERNS);
    if (dreamTarget) {
        return { mode: CONVERSATION_MODE.DREAMJOB, target: dreamTarget };
    }

    const nearTermTarget =
        firstTarget(normalized, NEAR_TERM_TRAILING_TARGET)
        ?? firstTarget(normalized, NEAR_TERM_LEADING_TARGET);
    if (nearTermTarget) {
        return { mode: CONVERSATION_MODE.NEAR_TERM, target: nearTermTarget };
    }

    return null;
};
