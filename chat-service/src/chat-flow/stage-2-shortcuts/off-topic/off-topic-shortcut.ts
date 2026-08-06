import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessageBaseContext } from "../../chat-flow.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { OFF_TOPIC_REDIRECT_REPLY } from "./off-topic.consts";
import { isClearlyOffTopic } from "./off-topic.utils";

export const tryOffTopicShortcutResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext
): Promise<ChatMessageResponse | null> => {
    if (!isClearlyOffTopic(ctx.normalizedMessage)) {
        return null;
    }

    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, OFF_TOPIC_REDIRECT_REPLY);
    return {
        reply: OFF_TOPIC_REDIRECT_REPLY,
        mode: CONVERSATION_MODE.GUIDED,
        confidenceSummary: ctx.confidenceSummary,
    };
};
