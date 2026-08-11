import type { Conversation } from "../../routes/conversation/conversation.model";
import type { UserCareerProfile } from "../../routes/career-profile/career-profile.types";
import type { ChatMessageResponse, JobSearchResultItem } from "../api/shared/chat.types";
import { rankJobs } from "./ranking/job-ranking.service";
import { mapRankedJobResultToChatMatchRow } from "./presentation/chat.job-presentation.utils";
import { EXHAUSTED_JOBS_REPLY, MAX_PRESENTED_JOBS } from "./present-jobs.consts";
import type { PresentRankedJobsOptions } from "./present-jobs.types";

const filterEligibleRankedJobs = (userCareerProfile: UserCareerProfile, jobs: JobSearchResultItem[], conversation: Conversation) => {
    const rejectedIds = new Set(conversation.jobContext?.jobRecommendationContext?.rejectedJobIds ?? []);
    const acceptedIds = new Set(conversation.jobContext?.jobRecommendationContext?.acceptedJobIds ?? []);
    const rankedJobs = rankJobs(userCareerProfile, jobs);
    const eligibleRanked = rankedJobs.filter(
        (item) => !rejectedIds.has(item.job.id) && !acceptedIds.has(item.job.id)
    );
    return { rankedJobs, orderedRankedPool: eligibleRanked.slice(0, 15) };
};

export const presentRankedJobs = async (options: PresentRankedJobsOptions): Promise<ChatMessageResponse> => {
    const {
        deps,
        ctx,
        jobs,
        searchIntent,
        conversation = ctx.conversationAfterUserMessage,
        queryLabel = ctx.normalizedMessage,
        includeRecommendedDirections = false,
    } = options;
    const {
        userId,
        conversationId,
        userCareerProfile,
        userRoleExperience,
        confidenceSummary,
    } = ctx;
    const mode = ctx.modeDetection.mode;

    const { orderedRankedPool } = filterEligibleRankedJobs(userCareerProfile, jobs, conversation);

    if (orderedRankedPool.length === 0) {
        await deps.conversationService.appendAssistantMessage(userId, conversationId, EXHAUSTED_JOBS_REPLY);
        return { reply: EXHAUSTED_JOBS_REPLY, mode, confidenceSummary };
    }

    const topRankedJobs = orderedRankedPool.map((item) => item.job);
    const focusJob = topRankedJobs[0] ?? null;
    const presentationJobs = topRankedJobs.slice(0, MAX_PRESENTED_JOBS);

    await deps.conversationService.setJobContextAfterSearch(
        userId,
        conversationId,
        topRankedJobs,
        focusJob,
        queryLabel,
        searchIntent
    );

    const reply =
        `Here are the roles I found that could fit — do any of these work for you? ` +
        `Tell me which one to add to your pipeline ` +
        `(e.g. "add the first one" or "add the ${presentationJobs[0]?.company ?? "first"} role"). ` +
        `If none fit, just say "none" and I can save a role to your wishlist so you're alerted when a better match appears.`;
    const jobMatches = orderedRankedPool
        .slice(0, MAX_PRESENTED_JOBS)
        .map((item) => mapRankedJobResultToChatMatchRow(item));

    const recommendedDirections = includeRecommendedDirections
        ? await deps.suggestDirections(userCareerProfile, userRoleExperience)
        : undefined;

    await deps.conversationService.appendAssistantMessage(userId, conversationId, reply, presentationJobs);

    return {
        reply,
        jobs: presentationJobs,
        jobMatches,
        ...(recommendedDirections ? { recommendedDirections } : {}),
        mode,
        confidenceSummary,
    };
};
