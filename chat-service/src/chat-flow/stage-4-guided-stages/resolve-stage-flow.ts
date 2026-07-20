import type { Conversation } from "../../routes/conversation/conversation.model";
import type { ConfidenceSummary } from "../stage-1-prepare-context/confidence/confidence.types";
import type { ConversationMode } from "../stage-1-prepare-context/mode-detection/conversation-mode.types";
import type { ChatFlowDeps, SendMessagePreparedContext, StageFlowSendMessageResult } from "../chat-flow.types";
import {
    applyStageAdvance,
    completeAllStages,
    getCurrentStage,
    recordStageMessage,
} from "../../routes/conversation/conversation.stage.utils";
import { generateStageReply } from "../shared/llm/chat.llm.service";

export const resolveStageFlowForSendMessage = async (params: {
    deps: ChatFlowDeps;
    normalizedMessage: string;
    conversationAfterUserMessage: Conversation;
    currentStage: ReturnType<typeof getCurrentStage>;
    shouldSkipStages: boolean;
    mode: ConversationMode;
    userId: string;
    conversationId: string;
    userAccountContext: string;
    userAchievements: SendMessagePreparedContext["userAchievements"];
    stageProgressWithNote: Conversation["stageProgress"];
    confidenceSummary: ConfidenceSummary;
}): Promise<StageFlowSendMessageResult> => {
    const {
        deps, conversationId, userId, normalizedMessage, conversationAfterUserMessage,
        currentStage, shouldSkipStages, mode, userAccountContext, userAchievements,
        stageProgressWithNote, confidenceSummary,
    } = params;
    const initialProgress = shouldSkipStages
        ? completeAllStages(stageProgressWithNote)
        : stageProgressWithNote;

    if (!currentStage || shouldSkipStages || mode === "FAST_SEARCH" || mode === "DREAMJOB") {
        return { kind: "continue_main_flow", progress: initialProgress };
    }

    const stageReply = await generateStageReply(
        deps.textCompletion,
        conversationAfterUserMessage,
        normalizedMessage,
        currentStage,
        userAchievements,
        mode,
        userAccountContext,
        deps.llmObserver
    );
    const nextStageProgress = applyStageAdvance(
        stageProgressWithNote,
        currentStage.id,
        stageReply.shouldAdvanceStage
    );
    const conversationAfterStageAdvance = {
        ...conversationAfterUserMessage,
        stageProgress: nextStageProgress,
    };
    const nextStage = getCurrentStage(conversationAfterStageAdvance, normalizedMessage);
    if (nextStage) {
        await deps.conversationService.updateStageProgress(userId, conversationId, nextStageProgress);
        await deps.conversationService.appendAssistantMessage(userId, conversationId, stageReply.reply);
        return {
            kind: "stage_reply_only",
            progress: nextStageProgress,
            reply: stageReply.reply,
            mode,
            confidenceSummary,
        };
    }
    return { kind: "continue_main_flow", progress: nextStageProgress };
};

export { getCurrentStage, recordStageMessage };
