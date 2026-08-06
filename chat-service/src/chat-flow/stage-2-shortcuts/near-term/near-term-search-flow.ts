import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { buildWorkDirectionFilters } from "../../stage-5-job-search/direction-filters/chat.direction.utils";
import { searchJobsWithBroaderFallback } from "../../stage-5-job-search/search-jobs";
import { mapRankedJobResultToChatMatchRow } from "../../stage-6-present-jobs/presentation/chat.job-presentation.utils";
import { rankJobs } from "../../stage-6-present-jobs/ranking/job-ranking.service";
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

    const rankedJobs = rankJobs(ctx.userCareerProfile, jobs);
    const topRankedJobs = rankedJobs.map((item) => item.job);
    const focusJob = topRankedJobs[0] ?? null;

    await deps.conversationService.setJobContextAfterSearch(
        ctx.userId,
        ctx.conversationId,
        topRankedJobs,
        focusJob,
        ctx.normalizedMessage,
        "SEARCH_PLAN"
    );

    // Present all matches at once (consistent with the main search flow).
    const presentationJobs = topRankedJobs.slice(0, 5);
    const reply =
        `Here are the roles I found that could fit — do any of these work for you? ` +
        `Tell me which one to add to your pipeline ` +
        `(e.g. "add the first one" or "add the ${presentationJobs[0]?.company ?? "first"} role"). ` +
        `If none fit, just say "none" and I can save a role to your wishlist so you're alerted when a better match appears.`;
    const jobMatches = rankedJobs.slice(0, 5).map((item) => mapRankedJobResultToChatMatchRow(item));

    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply, presentationJobs);

    return {
        reply,
        jobs: presentationJobs,
        jobMatches,
        mode: ctx.modeDetection.mode,
        confidenceSummary: ctx.confidenceSummary,
    };
};
