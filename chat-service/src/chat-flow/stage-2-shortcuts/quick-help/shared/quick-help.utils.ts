import type { ConversationMode } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.types";
import { CONVERSATION_MODE } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import type { QuickHelpFlow } from "../../../../routes/conversation/conversation.types";
import {
    QUICK_HELP_CV_INTENT_PATTERNS,
    QUICK_HELP_EXIT_PATTERNS,
    QUICK_HELP_INTERVIEW_INTENT_PATTERNS,
    QUICK_HELP_JOB_MATCH_INTENT_PATTERNS,
    QUICK_HELP_SKILLS_INTENT_PATTERNS,
} from "./quick-help.consts";
import type { QuickHelpIntent } from "./quick-help.types";

export const modeForQuickHelpFlow = (flow: QuickHelpFlow | undefined): ConversationMode | undefined => {
    if (!flow) {
        return undefined;
    }
    if (flow.kind === "skills_gap") {
        return CONVERSATION_MODE.SKILLS_GAP;
    }
    if (flow.kind === "cv_improve") {
        return CONVERSATION_MODE.CV_IMPROVE;
    }
    return CONVERSATION_MODE.INTERVIEW_PREP;
};

export const detectQuickHelpExitIntent = (message: string): boolean => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return false;
    }
    return QUICK_HELP_EXIT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const matchesAny = (message: string, patterns: readonly RegExp[]): boolean =>
    patterns.some((pattern) => pattern.test(message));

export const detectQuickHelpIntent = (message: string): QuickHelpIntent | null => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return null;
    }
    if (matchesAny(trimmed, QUICK_HELP_SKILLS_INTENT_PATTERNS)) {
        return "skills_gap";
    }
    if (matchesAny(trimmed, QUICK_HELP_JOB_MATCH_INTENT_PATTERNS)) {
        return "profile_job_match";
    }
    if (matchesAny(trimmed, QUICK_HELP_CV_INTENT_PATTERNS)) {
        return "cv_improve";
    }
    if (matchesAny(trimmed, QUICK_HELP_INTERVIEW_INTENT_PATTERNS)) {
        return "interview_prep";
    }
    return null;
};

export const parseJsonObjectFromLlm = (raw: string): Record<string, unknown> | null => {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() ?? trimmed;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            return null;
        }
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
};
