import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { ChatTurnDecision } from "../../api/shared/chat.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import {
    detectModeDeterministically,
    type DeterministicModeDetection,
} from "../../stage-1-prepare-context/mode-detection/deterministic-mode.utils";

/**
 * A conversation that has already produced a job search stays a job search. Without this, a turn
 * carrying no fresh signal — an aside, or a prompt-injection attempt — drops back to guided and
 * restarts the discovery questions the user has already answered.
 */
const carriedOverNearTerm = (
    decision: ChatTurnDecision,
    conversation?: Conversation
): DeterministicModeDetection | null => {
    if (decision.modeDetection.mode !== CONVERSATION_MODE.GUIDED) return null;
    const lastSearchQuery = conversation?.jobContext?.lastSearchQuery?.trim();
    if (!conversation?.jobContext?.lastSearchAt || !lastSearchQuery) return null;
    return { mode: CONVERSATION_MODE.NEAR_TERM, target: lastSearchQuery };
};

/**
 * The turn-decision prompt asks a small local model to classify intent, and it reliably answers
 * "guided" even when the user has stated plainly what they want. Where the message says it outright,
 * the deterministic reading wins; anything ambiguous is left to the model.
 */
export const applyDeterministicMode = (
    decision: ChatTurnDecision,
    message: string,
    conversation?: Conversation
): ChatTurnDecision => {
    const detected = detectModeDeterministically(message)
        ?? carriedOverNearTerm(decision, conversation);
    if (!detected || detected.mode === decision.modeDetection.mode) {
        return decision;
    }

    const isCarriedOver = detectModeDeterministically(message) === null;
    const isNearTerm = detected.mode === CONVERSATION_MODE.NEAR_TERM && !isCarriedOver;
    const target = detected.target ?? decision.modeDetection.searchQuery;

    return {
        ...decision,
        shouldSearchJobs: isNearTerm ? true : decision.shouldSearchJobs,
        modeDetection: {
            ...decision.modeDetection,
            mode: detected.mode,
            isReady: target !== undefined,
            readinessScore: target !== undefined ? 100 : decision.modeDetection.readinessScore,
            missingInformation: target !== undefined ? [] : decision.modeDetection.missingInformation,
            dreamJobTitle: detected.mode === CONVERSATION_MODE.DREAMJOB
                ? detected.target ?? decision.modeDetection.dreamJobTitle
                : decision.modeDetection.dreamJobTitle,
            shouldSearchJobs: isNearTerm ? true : decision.modeDetection.shouldSearchJobs,
            searchQuery: isNearTerm ? target : decision.modeDetection.searchQuery,
        },
    };
};
