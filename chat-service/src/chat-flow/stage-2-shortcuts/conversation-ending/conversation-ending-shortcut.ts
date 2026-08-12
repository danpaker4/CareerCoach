import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import {
    buildConversationEndPrompt,
    CONVERSATION_END_REPLY,
    parseConversationEndDecision,
} from "./conversation-ending.utils";

const hasCompletedPipelineInteraction = (ctx: SendMessagePreparedContext): boolean => {
    const recommendation = ctx.conversationAfterUserMessage.jobContext?.jobRecommendationContext;
    return recommendation?.awaitingPipelineDecision === false
        && (recommendation.acceptedJobIds.length > 0 || recommendation.rejectedJobIds.length > 0);
};

const findLatestAssistantMessage = (ctx: SendMessagePreparedContext): string =>
    [...ctx.conversationAfterUserMessage.messages]
        .reverse()
        .find((message) => message.role === "assistant")
        ?.content ?? "";

export const tryConversationEndResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
): Promise<ChatMessageResponse | null> => {
    if (!hasCompletedPipelineInteraction(ctx)) return null;

    const latestAssistantMessage = findLatestAssistantMessage(ctx);
    if (latestAssistantMessage.length === 0) return null;

    const rawDecision = await deps.textCompletion.complete(
        buildConversationEndPrompt(latestAssistantMessage, ctx.normalizedMessage),
        {
            operation: "chat.conversation_end",
            userId: ctx.userId,
            sessionId: ctx.conversationId,
            feature: "chat",
            responseFormat: "json",
        },
    ).catch(() => "");
    if (!parseConversationEndDecision(rawDecision)) return null;

    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, CONVERSATION_END_REPLY);
    return {
        reply: CONVERSATION_END_REPLY,
        mode: ctx.modeDetection.mode,
        confidenceSummary: ctx.confidenceSummary,
    };
};
