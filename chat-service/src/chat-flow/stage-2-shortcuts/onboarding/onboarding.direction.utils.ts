import type { OnboardingInitialMode } from "../../../routes/conversation/conversation.types";
import {
    isDreamJobPivotMessage,
    isNearTermPivotMessage,
    isUndecidedDirectionMessage,
} from "../../stage-1-prepare-context/mode-detection/conversation-mode.pivot.utils";

/** Extra near-term phrases common during the onboarding direction question. */
const ONBOARDING_NEAR_TERM_PATTERNS: readonly RegExp[] = [
    /\blooking for something\s+(?:now|soon|asap)\b/i,
    /\b(?:want|wanna|need)\s+something\s+(?:now|soon|asap)\b/i,
    /\b(?:a\s+)?jobs?\s+(?:now|soon|asap)\b/i,
    /\b(?:want|wanna|need)\s+to\s+change\s+jobs?\b/i,
    /\bchange\s+jobs?\s+(?:now|soon|asap)\b/i,
    /\bfind\s+(?:me\s+)?(?:a\s+)?(?:job|role|position)s?\b/i,
    /\bshow\s+me\s+(?:a\s+)?(?:job|role|position)s?\b/i,
    /\bskip\s+to\s+(?:the\s+)?jobs?\b/i,
    /^(?:now|soon|asap|right now|immediately)\.?$/i,
    /\bfor now\b/i,
    /\bnext\s+(?:\d{1,2}\s+|few\s+)?months?\b/i,
];

export const resolveOnboardingDirectionMode = (message: string): OnboardingInitialMode | null => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return null;
    }
    if (isUndecidedDirectionMessage(trimmed)) {
        return "GUIDED";
    }
    if (isDreamJobPivotMessage(trimmed)) {
        return "DREAMJOB";
    }
    if (isNearTermPivotMessage(trimmed) || ONBOARDING_NEAR_TERM_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return "NEAR_TERM";
    }
    return null;
};
