import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import { buildWishlistSavePrompt } from "../../wanted-jobs/chat.wishlist.utils";
import type { HandlePipelineRejectParams } from "./pipeline-reject.types";

export const handlePipelineReject = async (params: HandlePipelineRejectParams): Promise<ChatMessageResponse> => {
    const { deps, ctx, jobContext } = params;
    const { userId, conversationId, confidenceSummary } = ctx;
    const mode = ctx.modeDetection.mode;
    const job = jobContext.selectedJobSnapshot;
    const rec = jobContext.jobRecommendationContext;
    if (!job || !rec) {
        const reply = "I do not have an active job recommendation to skip. Ask me for roles and I will suggest one.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }

    // We now present all matches at once, so a rejection means "none of these fit". Offer to
    // save the role to the wishlist for alerts (the user confirms) — or they can keep exploring.
    const proposedTitle = jobContext.lastSearchQuery?.trim() || job.title;
    const now = new Date();
    await deps.conversationService.saveJobContext(userId, conversationId, {
        ...jobContext,
        jobRecommendationContext: {
            ...rec,
            awaitingPipelineDecision: false,
            lastRecommendationAt: now,
        },
        updatedAt: now,
    });
    const reply = buildWishlistSavePrompt(
        proposedTitle,
        "No problem — none of those have to be the one. If you'd like, I can keep this role on your radar."
    );
    await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
    return { reply, mode, confidenceSummary };
};
