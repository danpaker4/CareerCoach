import type { Conversation, ConversationStageProgress } from "./conversation.model";
import type { ConversationStage } from "./conversation.types";
import { CONVERSATION_STAGES, STAGE_SIGNALS } from "./conversation.stage.consts";
import { appendStageNote, defaultStageProgress } from "./conversation.utils";

export const getInitialAssistantMessage = (): string =>
    "Hey! Great to meet you. Tell me a bit about your background—or what you're interested in lately if you're still figuring out the next step.";

const getCompletedStageIds = (stageProgress: ConversationStageProgress): string[] =>
    stageProgress.completedStageIds ?? [];

const inferStageFromMessage = (userMessage: string, completedStageIds: readonly string[]): string | null => {
    const normalizedMessage = userMessage.trim().toLowerCase();
    if (!normalizedMessage) {
        return null;
    }

    for (const stage of CONVERSATION_STAGES) {
        if (completedStageIds.includes(stage.id)) {
            continue;
        }
        const hints = STAGE_SIGNALS[stage.id] ?? [];
        if (hints.some((hint) => normalizedMessage.includes(hint))) {
            return stage.id;
        }
    }

    return null;
};

const getFirstIncompleteStageId = (completedStageIds: readonly string[]): string | null => {
    for (const stage of CONVERSATION_STAGES) {
        if (!completedStageIds.includes(stage.id)) {
            return stage.id;
        }
    }
    return null;
};

export const recordStageMessage = (
    conversation: Conversation,
    userMessage: string,
    stageId: string
): ConversationStageProgress => {
    const stageProgress = conversation.stageProgress ?? defaultStageProgress();
    const normalizedMessage = userMessage.trim();
    return appendStageNote(stageProgress, stageId, normalizedMessage);
};

export const getCurrentStage = (conversation: Conversation, latestUserMessage?: string): ConversationStage | null => {
    const stageProgress = conversation.stageProgress ?? defaultStageProgress();
    const completedStageIds = getCompletedStageIds(stageProgress);
    const inferredStageId = latestUserMessage
        ? inferStageFromMessage(latestUserMessage, completedStageIds)
        : null;
    const selectedStageId = inferredStageId
        ?? (stageProgress.currentStageId && !completedStageIds.includes(stageProgress.currentStageId) ? stageProgress.currentStageId : null)
        ?? getFirstIncompleteStageId(completedStageIds);

    return CONVERSATION_STAGES.find((stage) => stage.id === selectedStageId) ?? null;
};

export const completeAllStages = (stageProgress: ConversationStageProgress): ConversationStageProgress => ({
    ...stageProgress,
    currentStageIndex: CONVERSATION_STAGES.length,
    currentStageId: undefined,
    completedStageIds: CONVERSATION_STAGES.map((stage) => stage.id),
    awaitingConfirmation: false,
});

export const applyStageAdvance = (
    stageProgress: ConversationStageProgress,
    currentStageId: string,
    shouldAdvance: boolean
): ConversationStageProgress => {
    if (!shouldAdvance) {
        return stageProgress;
    }

    const completedStageIds = getCompletedStageIds(stageProgress);
    const nextCompletedStageIds = completedStageIds.includes(currentStageId)
        ? completedStageIds
        : [...completedStageIds, currentStageId];
    const nextStageId = getFirstIncompleteStageId(nextCompletedStageIds) ?? undefined;

    return {
        ...stageProgress,
        currentStageIndex: nextCompletedStageIds.length,
        currentStageId: nextStageId,
        completedStageIds: nextCompletedStageIds,
        awaitingConfirmation: false,
    };
};
