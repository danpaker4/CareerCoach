import type { Conversation, ConversationStageProgress } from "./conversation.model";
import { CONVERSATION_STAGES, type ConversationStage } from "./conversation.stage.consts";

const defaultStageProgress = (): ConversationStageProgress => ({
    currentStageIndex: 0,
    currentStageId: CONVERSATION_STAGES[0]?.id,
    completedStageIds: [],
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

    private getCompletedStageIds = (stageProgress: ConversationStageProgress): string[] =>
        stageProgress.completedStageIds ?? [];

    private inferStageFromMessage = (userMessage: string, completedStageIds: readonly string[]): string | null => {
        const normalizedMessage = userMessage.trim().toLowerCase();
        if (!normalizedMessage) {
            return null;
        }

        const stageSignals: Record<string, readonly string[]> = {
            achievements: ["experience", "project", "built", "developed", "worked", "achievement", "skill", "stack"],
            timeline: ["immediately", "asap", "soon", "timeline", "months", "years", "long-term", "long term", "future", "now"],
            preferences: ["role", "position", "product manager", "frontend", "backend", "fullstack", "domain", "industry", "prefer"],
        };

        for (const stage of CONVERSATION_STAGES) {
            if (completedStageIds.includes(stage.id)) {
                continue;
            }
            const hints = stageSignals[stage.id] ?? [];
            if (hints.some((hint) => normalizedMessage.includes(hint))) {
                return stage.id;
            }
        }

        return null;
    };

    private getFirstIncompleteStageId = (completedStageIds: readonly string[]): string | null => {
        for (const stage of CONVERSATION_STAGES) {
            if (!completedStageIds.includes(stage.id)) {
                return stage.id;
            }
        }
        return null;
    };

    recordStageMessage = (conversation: Conversation, userMessage: string, stageId: string): ConversationStageProgress => {
        const stageProgress = conversation.stageProgress ?? defaultStageProgress();
        const normalizedMessage = userMessage.trim();
        return appendStageNote(stageProgress, stageId, normalizedMessage);
    };

    getCurrentStage = (conversation: Conversation, latestUserMessage?: string): ConversationStage | null => {
        const stageProgress = conversation.stageProgress ?? defaultStageProgress();
        const completedStageIds = this.getCompletedStageIds(stageProgress);
        const inferredStageId = latestUserMessage
            ? this.inferStageFromMessage(latestUserMessage, completedStageIds)
            : null;
        const selectedStageId = inferredStageId
            ?? (stageProgress.currentStageId && !completedStageIds.includes(stageProgress.currentStageId) ? stageProgress.currentStageId : null)
            ?? this.getFirstIncompleteStageId(completedStageIds);

        return CONVERSATION_STAGES.find((stage) => stage.id === selectedStageId) ?? null;
    };

    completeAllStages = (stageProgress: ConversationStageProgress): ConversationStageProgress => ({
        ...stageProgress,
        currentStageIndex: CONVERSATION_STAGES.length,
        currentStageId: undefined,
        completedStageIds: CONVERSATION_STAGES.map((stage) => stage.id),
        awaitingConfirmation: false,
    });

    applyStageAdvance = (
        stageProgress: ConversationStageProgress,
        currentStageId: string,
        shouldAdvance: boolean
    ): ConversationStageProgress => {
        if (!shouldAdvance) {
            return stageProgress;
        }

        const completedStageIds = this.getCompletedStageIds(stageProgress);
        const nextCompletedStageIds = completedStageIds.includes(currentStageId)
            ? completedStageIds
            : [...completedStageIds, currentStageId];
        const nextStageId = this.getFirstIncompleteStageId(nextCompletedStageIds) ?? undefined;

        return {
            ...stageProgress,
            currentStageIndex: nextCompletedStageIds.length,
            currentStageId: nextStageId,
            completedStageIds: nextCompletedStageIds,
            awaitingConfirmation: false,
        };
    };
}
