import type { ProfileInput } from "../routes/conversation/conversation.types";
import type { ChatMessageResponse } from "./api/shared/chat.types";
import type { ChatFlow, ChatFlowDeps } from "./chat-flow.types";
import { decideNextStep } from "./shared/llm/chat.llm.service";
import { runStage1PrepareContext } from "./stage-1-prepare-context/prepare-context";
import { tryOffTopicShortcutResponse } from "./stage-2-shortcuts/off-topic/off-topic-shortcut";
import { tryQuickHelpShortcutResponse } from "./stage-2-shortcuts/quick-help/run-quick-help";
import { runStage2Shortcuts } from "./stage-2-shortcuts/run-stage-2-shortcuts";
import { runStage3LlmDecision } from "./stage-3-llm-decision/run-stage-3-llm-decision";

export const sendMessage = async (
    deps: ChatFlowDeps,
    userId: string,
    message: string,
    profile?: ProfileInput,
    conversationId?: string,
    authorization?: string
): Promise<ChatMessageResponse> => {
    const normalizedMessage = message.trim();
    if (normalizedMessage.length === 0) {
        throw new Error("Message is required");
    }
    console.info(`[CHAT][INTENT] userId=${userId} incoming="${normalizedMessage}"`);

    const baseContext = await runStage1PrepareContext(deps, {
        userId,
        normalizedMessage,
        profile,
        requestedConversationId: conversationId,
        authorization,
    });
    const offTopicResponse = await tryOffTopicShortcutResponse(deps, baseContext);
    if (offTopicResponse) {
        return offTopicResponse;
    }

    const quickHelpResponse = await tryQuickHelpShortcutResponse(deps, baseContext);
    if (quickHelpResponse) {
        return quickHelpResponse;
    }

    const turnDecision = await decideNextStep(deps, baseContext);
    const ctx = {
        ...baseContext,
        modeDetection: turnDecision.modeDetection,
    };

    const shortcutResponse = await runStage2Shortcuts(deps, ctx);
    if (shortcutResponse) {
        return shortcutResponse;
    }

    return await runStage3LlmDecision(deps, ctx, turnDecision);
};

export const createChatFlow = (deps: ChatFlowDeps): ChatFlow => ({
    sendMessage: (userId, message, profile, conversationId, authorization) =>
        sendMessage(deps, userId, message, profile, conversationId, authorization),
});
