import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import {
    buildRefineOfferReply,
    isAlreadySpecific,
    isJobWantIntent,
    namesSearchTarget,
    wasRefineOfferedBefore,
} from "../../stage-5-job-search/search-plan/chat.refine-search.utils";

export const tryRefineSearchOfferResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    if (wasRefineOfferedBefore(ctx.conversationAfterUserMessage.messages)) {
        return null;
    }
    // The offer exists for an under-specified "find me a job". Once the turn carries a role to search
    // for, asking the user to narrow it stalls a request that is already actionable.
    if (namesSearchTarget(ctx.modeDetection)) {
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
