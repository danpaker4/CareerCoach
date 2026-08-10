import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import {
    buildRefineOfferReply,
    isAlreadySpecific,
    isJobWantIntent,
    wasRefineOfferedBefore,
} from "../../stage-5-job-search/search-plan/chat.refine-search.utils";

export const tryRefineSearchOfferResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    if (wasRefineOfferedBefore(ctx.conversationAfterUserMessage.messages)) {
        return null;
    }
    if (!isJobWantIntent(ctx.normalizedMessage) || isAlreadySpecific(ctx.normalizedMessage)) {
        return null;
    }
    const reply = buildRefineOfferReply();
    console.info(`[CHAT][REFINE] userId=${ctx.userId} offering search refinement`);
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return { reply, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
};
