import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import {
    buildConversationEndPrompt,
    CONVERSATION_END_REPLY,
    isExplicitConversationEndMessage,
    parseConversationEndDecision,
} from "./conversation-ending.utils";

const hasPipelineInteraction = (ctx: SendMessagePreparedContext): boolean => {
    const recommendation = ctx.conversationAfterUserMessage.jobContext?.jobRecommendationContext;
    if (!recommendation) return false;

    return recommendation.awaitingPipelineDecision
        || recommendation.acceptedJobIds.length > 0
        || recommendation.rejectedJobIds.length > 0;
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
    if (!hasPipelineInteraction(ctx)) return null;

    const latestAssistantMessage = findLatestAssistantMessage(ctx);
    if (latestAssistantMessage.length === 0) return null;

    const hasExplicitEndIntent = isExplicitConversationEndMessage(ctx.normalizedMessage);
    if (!hasExplicitEndIntent) {
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
    }

    const jobContext = ctx.conversationAfterUserMessage.jobContext;
    const recommendation = jobContext?.jobRecommendationContext;
    if (jobContext && recommendation?.awaitingPipelineDecision) {
        const now = new Date();
        await deps.conversationService.saveJobContext(ctx.userId, ctx.conversationId, {
            ...jobContext,
            jobRecommendationContext: {
                ...recommendation,
                awaitingPipelineDecision: false,
            },
            updatedAt: now,
        });
    }

    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, CONVERSATION_END_REPLY);
    return {
        reply: CONVERSATION_END_REPLY,
        mode: ctx.modeDetection.mode,
        confidenceSummary: ctx.confidenceSummary,
    };
};
