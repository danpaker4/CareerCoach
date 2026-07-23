import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { buildWorkDirectionFilters } from "../../stage-5-job-search/direction-filters/chat.direction.utils";
import { searchJobsWithBroaderFallback } from "../../stage-5-job-search/search-jobs";
import {
    applyValidatedJobsFallback,
    mapRankedJobResultToChatMatchRow,
    withPipelineClosing,
} from "../../stage-6-present-jobs/presentation/chat.job-presentation.utils";
import { rankJobs } from "../../stage-6-present-jobs/ranking/job-ranking.service";

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
        const fallback = `I searched for ${query} roles but couldn't find any open positions matching that right now. Could you share a different role or field you'd like to explore?`;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, fallback);
        return { reply: fallback, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
    }

    const rankedJobs = rankJobs(ctx.userCareerProfile, jobs);
    const topRankedJobs = rankedJobs.map((item) => item.job);
    const focusJob = topRankedJobs[0];

    const fallbackPack = applyValidatedJobsFallback(topRankedJobs.slice(0, 10), "", focusJob);
    const sanitized = withPipelineClosing(fallbackPack.sanitizedReply);

    await deps.conversationService.setJobContextAfterSearch(
        ctx.userId,
        ctx.conversationId,
        topRankedJobs,
        focusJob,
        ctx.normalizedMessage,
        "SEARCH_PLAN"
    );

    const presentationJobs = fallbackPack.validatedJobs.slice(0, 1);
    const primaryJobId = presentationJobs[0]?.id;
    const jobMatches = rankedJobs
        .filter((item) => item.jobId === primaryJobId)
        .map((item) => mapRankedJobResultToChatMatchRow(item));

    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, sanitized, presentationJobs);

    return {
        reply: sanitized,
        jobs: presentationJobs,
        jobMatches,
        mode: ctx.modeDetection.mode,
        confidenceSummary: ctx.confidenceSummary,
    };
};
