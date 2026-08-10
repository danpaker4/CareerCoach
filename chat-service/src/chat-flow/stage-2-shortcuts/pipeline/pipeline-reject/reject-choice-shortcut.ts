import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";
import { saveWishlistFromMessage } from "../../wanted-jobs/wishlist-shortcut";
import { runPipelineRejectBroaden } from "./pipeline-reject.service";
import {
    detectRejectChoice,
    extractRejectChoiceTitle,
    wasRejectChoiceOfferedLast,
} from "./reject-choice.utils";

export const tryRejectChoiceResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    const messages = ctx.conversationAfterUserMessage.messages;
    if (!wasRejectChoiceOfferedLast(messages)) {
        return null;
    }

    const choice = detectRejectChoice(ctx.normalizedMessage);
    if (!choice) {
        return null;
    }

    const jobContext = ctx.conversationAfterUserMessage.jobContext;
    if (!jobContext) {
        return null;
    }

    console.info(`[CHAT][REJECT_CHOICE] userId=${ctx.userId} choice=${choice}`);

    if (choice === "BROADEN") {
        return await runPipelineRejectBroaden({ deps, ctx, jobContext });
    }

    const proposedTitle =
        extractRejectChoiceTitle(messages) ??
        jobContext.selectedJobSnapshot?.title ??
        (jobContext.lastSearchQuery ?? "");
    return await saveWishlistFromMessage(deps, ctx, proposedTitle.trim());
};
