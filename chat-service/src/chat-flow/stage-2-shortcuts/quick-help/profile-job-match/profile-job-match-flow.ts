import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessageBaseContext } from "../../../chat-flow.types";
import { CONVERSATION_MODE } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { buildWorkDirectionFilters } from "../../../stage-5-job-search/direction-filters/chat.direction.utils";
import { searchJobsWithBroaderFallback } from "../../../stage-5-job-search/search-jobs";
import {
    applyValidatedJobsFallback,
    mapRankedJobResultToChatMatchRow,
    withPipelineClosing,
} from "../../../stage-6-present-jobs/presentation/chat.job-presentation.utils";
import { rankJobs } from "../../../stage-6-present-jobs/ranking/job-ranking.service";
import { buildProfileJobSearchQuery } from "./profile-job-match.utils";

export const runProfileJobMatchFlow = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext
): Promise<ChatMessageResponse> => {
    const query = buildProfileJobSearchQuery({
        profile: ctx.profile,
        userAchievements: ctx.userAchievements,
    });
    const searchFilters = buildWorkDirectionFilters(query);
    console.info(
        `[CHAT][SEARCH] userId=${ctx.userId} trigger=PROFILE_JOB_MATCH query="${query}" filters=${JSON.stringify(searchFilters)}`
    );

    const jobs = await searchJobsWithBroaderFallback({
        externalService: deps.externalService,
        userCareerProfile: ctx.userCareerProfile,
        userRoleExperience: ctx.userRoleExperience,
        searchFilters,
        userId: ctx.userId,
        trigger: "PROFILE_JOB_MATCH",
    });

    if (jobs.length === 0) {
        const fallback =
            "I looked for roles matching your skills, but nothing strong came back right now. Share a target role or skill to refine the search.";
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, fallback);
        return {
            reply: fallback,
            mode: CONVERSATION_MODE.NEAR_TERM,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    const rankedJobs = rankJobs(ctx.userCareerProfile, jobs);
    const topRankedJobs = rankedJobs.map((item) => item.job);
    const focusJob = topRankedJobs[0];
    const fallbackPack = applyValidatedJobsFallback(topRankedJobs.slice(0, 10), "", focusJob);
    const sanitized = withPipelineClosing(
        `Based on your profile skills, here are roles that look like a fit.\n\n${fallbackPack.sanitizedReply}`
    );

    await deps.conversationService.setJobContextAfterSearch(
        ctx.userId,
        ctx.conversationId,
        topRankedJobs,
        focusJob,
        query,
        "PROFILE_JOB_MATCH"
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
        mode: CONVERSATION_MODE.NEAR_TERM,
        confidenceSummary: ctx.confidenceSummary,
    };
};
