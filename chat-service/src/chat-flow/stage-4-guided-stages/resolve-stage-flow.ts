import type { StageFlowSendMessageResult } from "../chat-flow.types";
import { CONVERSATION_MODE } from "../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import {
    applyStageAdvance,
    completeAllStages,
    getCurrentStage,
    recordStageMessage,
} from "../../routes/conversation/conversation.stage.utils";
import { generateStageReply } from "../shared/llm/chat.llm.service";
import type { ResolveStageFlowForSendMessageParams } from "./resolve-stage-flow.types";

export const resolveStageFlowForSendMessage = async (
    params: ResolveStageFlowForSendMessageParams
): Promise<StageFlowSendMessageResult> => {
    const { deps, ctx, shouldSkipStages } = params;
    const {
        userId,
        conversationId,
        normalizedMessage,
        conversationAfterUserMessage,
        userAccountContext,
        userAchievements,
        confidenceSummary,
    } = ctx;
    const mode = ctx.modeDetection.mode;
    const currentStage = getCurrentStage(conversationAfterUserMessage, normalizedMessage);
    const stageProgressWithNote = currentStage
        ? recordStageMessage(conversationAfterUserMessage, normalizedMessage, currentStage.id)
        : conversationAfterUserMessage.stageProgress;
    const initialProgress = shouldSkipStages
        ? completeAllStages(stageProgressWithNote)
        : stageProgressWithNote;

    if (!currentStage || shouldSkipStages || mode === CONVERSATION_MODE.DREAMJOB) {
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
