import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { buildWorkDirectionFilters } from "../../stage-5-job-search/direction-filters/chat.direction.utils";
import { searchJobsWithBroaderFallback } from "../../stage-5-job-search/search-jobs";
import { presentRankedJobs } from "../../stage-6-present-jobs/present-jobs";
import { buildWishlistSavePrompt } from "../wanted-jobs/chat.wishlist.utils";
import { buildWantedJobInputFromSearch } from "../wanted-jobs/wanted-job.service";

export const runNearTermSearchFlow = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse> => {
    const detectedQuery = ctx.modeDetection.searchQuery;
    const query = detectedQuery !== undefined && detectedQuery.trim() !== "" ? detectedQuery : ctx.normalizedMessage;
    const searchFilters = buildWorkDirectionFilters(query);
    console.info(
        `[CHAT][SEARCH] userId=${ctx.userId} trigger=NEAR_TERM query="${query}" filters=${JSON.stringify(searchFilters)}`
    );
    const jobs = await searchJobsWithBroaderFallback({
        externalService: deps.externalService,
        userCareerProfile: ctx.userCareerProfile,
        userRoleExperience: ctx.userRoleExperience,
        searchFilters,
        userId: ctx.userId,
        trigger: CONVERSATION_MODE.NEAR_TERM,
    });

    if (jobs.length === 0) {
        // Offer to save it to the wishlist (user confirms) so they get alerted when one appears.
        const wantedJobInput = buildWantedJobInputFromSearch({
            userId: ctx.userId,
            normalizedMessage: ctx.normalizedMessage,
            searchFilters,
        });
        const proposedTitle = wantedJobInput?.jobTitle ?? query.trim();
        const fallback = proposedTitle.length > 0
            ? buildWishlistSavePrompt(
                proposedTitle,
                `I searched for ${query} roles but couldn't find any open positions matching that right now.`
            )
            : `I searched for ${query} roles but couldn't find any open positions matching that right now. Could you share a different role or field you'd like to explore?`;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, fallback);
        return { reply: fallback, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
    }

    return await presentRankedJobs({
        deps,
        ctx,
        jobs,
        searchIntent: "SEARCH_PLAN",
        queryLabel: ctx.normalizedMessage,
    });
};
