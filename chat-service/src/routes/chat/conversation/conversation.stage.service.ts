import type { Conversation, ConversationStageProgress } from "./conversation.model";
import { CONVERSATION_STAGES, type ConversationStage } from "./conversation.stage.consts";

const defaultStageProgress = (): ConversationStageProgress => ({
    currentStageIndex: 0,
    awaitingConfirmation: false,
    stageNotes: {},
    surfacedAchievementIds: [],
});

const appendStageNote = (stageProgress: ConversationStageProgress, stageId: string, note: string): ConversationStageProgress => {
    const existing = stageProgress.stageNotes[stageId] ?? [];
    return {
        ...stageProgress,
        stageNotes: {
            ...stageProgress.stageNotes,
            [stageId]: [...existing, note],
        },
    };
};

export class ConversationStageService {
    getInitialAssistantMessage = (): string => "Hey! Great to meet you. Tell me a bit about yourself.";

    recordStageMessage = (conversation: Conversation, userMessage: string): ConversationStageProgress => {
        const stageProgress = conversation.stageProgress ?? defaultStageProgress();
        const currentStage = CONVERSATION_STAGES[stageProgress.currentStageIndex];
        if (!currentStage) {
            return stageProgress;
        }

        const normalizedMessage = userMessage.trim();
        return appendStageNote(stageProgress, currentStage.id, normalizedMessage);
    };

    getCurrentStage = (conversation: Conversation): ConversationStage | null => {
        const stageProgress = conversation.stageProgress ?? defaultStageProgress();
        return CONVERSATION_STAGES[stageProgress.currentStageIndex] ?? null;
    };

    applyStageAdvance = (stageProgress: ConversationStageProgress, shouldAdvance: boolean): ConversationStageProgress => {
        if (!shouldAdvance) {
            return stageProgress;
        }

        return {
            ...stageProgress,
            currentStageIndex: stageProgress.currentStageIndex + 1,
            awaitingConfirmation: false,
        };
    };
}
