import type { StageFlowSendMessageResult } from "../chat-flow.types";
import { CONVERSATION_MODE } from "../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import {
    applyStageAdvance,
    completeAllStages,
    getCurrentStage,
    recordStageMessage,
} from "../../routes/conversation/conversation.stage.utils";
import type { ResolveStageFlowForSendMessageParams } from "./resolve-stage-flow.types";

export const resolveStageFlowForSendMessage = async (
    params: ResolveStageFlowForSendMessageParams
): Promise<StageFlowSendMessageResult> => {
    const { deps, ctx, shouldSkipStages, stageDecision } = params;
    const {
        userId,
        conversationId,
        normalizedMessage,
        conversationAfterUserMessage,
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

    const nextStageProgress = applyStageAdvance(
        stageProgressWithNote,
        currentStage.id,
        stageDecision.shouldAdvanceStage
    );
    const conversationAfterStageAdvance = {
        ...conversationAfterUserMessage,
        stageProgress: nextStageProgress,
    };
    const nextStage = getCurrentStage(conversationAfterStageAdvance, normalizedMessage);
    if (nextStage) {
        await deps.conversationService.updateStageProgress(userId, conversationId, nextStageProgress);
        await deps.conversationService.appendAssistantMessage(userId, conversationId, stageDecision.reply);
        return {
            kind: "stage_reply_only",
            progress: nextStageProgress,
            reply: stageDecision.reply,
            mode,
            confidenceSummary,
        };
    }
    return { kind: "continue_main_flow", progress: nextStageProgress };
};
