import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { buildWorkDirectionFilters } from "../../stage-5-job-search/direction-filters/chat.direction.utils";
import { searchJobsWithBroaderFallback } from "../../stage-5-job-search/search-jobs";
import { mapRankedJobResultToChatMatchRow } from "../../stage-6-present-jobs/presentation/chat.job-presentation.utils";
import {
    filterJobsMatchingSearchQuery,
    rankJobsBySearchQuery,
} from "../../stage-6-present-jobs/ranking/job-ranking.service";
import { buildWishlistSavePrompt } from "../wanted-jobs/chat.wishlist.utils";
import { buildWantedJobInputFromSearch } from "../wanted-jobs/wanted-job.service";

export const runNearTermSearchFlow = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    queryOverride?: string
): Promise<ChatMessageResponse> => {
    const detectedQuery = queryOverride ?? ctx.modeDetection.searchQuery;
    const query = detectedQuery !== undefined && detectedQuery.trim() !== "" ? detectedQuery : ctx.normalizedMessage;
    const searchFilters = buildWorkDirectionFilters(query);
    console.info(
        `[CHAT][SEARCH] userId=${ctx.userId} trigger=NEAR_TERM query="${query}" filters=${JSON.stringify(searchFilters)}`
    );
    const rawJobs = await searchJobsWithBroaderFallback({
        externalService: deps.externalService,
        userCareerProfile: ctx.userCareerProfile,
        userRoleExperience: ctx.userRoleExperience,
        searchFilters,
        userId: ctx.userId,
        trigger: CONVERSATION_MODE.NEAR_TERM,
        strictDirectionOnly: true,
    });
    const jobs = filterJobsMatchingSearchQuery(
        [...searchFilters.keywords, ...searchFilters.interests].join(" "),
        rawJobs,
    );

    if (jobs.length === 0) {
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

    const rankedJobs = rankJobsBySearchQuery(query, jobs);
    const topRankedJobs = rankedJobs.map((item) => item.job);
    const focusJob = topRankedJobs[0] ?? null;
    const presentationJobs = topRankedJobs.slice(0, 5);

    await deps.conversationService.setJobContextAfterSearch(
        ctx.userId,
        ctx.conversationId,
        topRankedJobs,
        focusJob,
        query,
        "SEARCH_PLAN",
        presentationJobs,
    );

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
