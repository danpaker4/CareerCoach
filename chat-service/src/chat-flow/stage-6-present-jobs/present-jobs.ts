import type { Conversation } from "../../routes/conversation/conversation.model";
import type { UserCareerProfile } from "../../routes/career-profile/career-profile.types";
import type { ChatMessageResponse, JobSearchResultItem } from "../api/shared/chat.types";
import { rankJobs } from "./ranking/job-ranking.service";
import { hasRankableProfile } from "./ranking/job-ranking.utils";
import {
    applyValidatedJobsFallback,
    mapRankedJobResultToChatMatchRow,
    withJobSelectionClosing,
} from "./presentation/chat.job-presentation.utils";
import { resolveSelectedJobFromRecommendations } from "./presentation/chat.job-mapping.utils";
import { sanitizeReply, validateRecommendedJobs } from "./presentation/chat.validation.service";
import { generateJobAwareReply } from "../shared/llm/chat.llm.service";
import {
    EXHAUSTED_JOBS_REPLY,
    MAX_PRESENTED_JOBS,
    MAX_RANKED_POOL,
    MIN_PRESENTED_MATCH_SCORE,
    WEAK_MATCH_REPLY,
} from "./present-jobs.consts";
import type { PresentRankedJobsOptions } from "./present-jobs.types";

export const filterEligibleRankedJobs = (userCareerProfile: UserCareerProfile, jobs: JobSearchResultItem[], conversation: Conversation) => {
    const rejectedIds = new Set(conversation.jobContext?.jobRecommendationContext?.rejectedJobIds ?? []);
    const acceptedIds = new Set(conversation.jobContext?.jobRecommendationContext?.acceptedJobIds ?? []);
    const rankedJobs = rankJobs(userCareerProfile, jobs);
    const eligibleRanked = rankedJobs.filter(
        (item) => !rejectedIds.has(item.job.id) && !acceptedIds.has(item.job.id)
    );
    const wellMatched = hasRankableProfile(userCareerProfile)
        ? eligibleRanked.filter((item) => item.finalScore >= MIN_PRESENTED_MATCH_SCORE)
        : eligibleRanked;
    return {
        rankedJobs,
        orderedRankedPool: wellMatched.slice(0, MAX_RANKED_POOL),
        filteredOutByMatch: eligibleRanked.length > 0 && wellMatched.length === 0,
    };
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
        directionHint,
    } = options;
    const {
        userId,
        conversationId,
        normalizedMessage,
        userCareerProfile,
        userRoleExperience,
        userAccountContext,
        userAchievements,
        confidenceSummary,
    } = ctx;
    const mode = ctx.modeDetection.mode;

    const { rankedJobs, orderedRankedPool, filteredOutByMatch } = filterEligibleRankedJobs(userCareerProfile, jobs, conversation);

    if (orderedRankedPool.length === 0) {
        const reply = filteredOutByMatch ? WEAK_MATCH_REPLY : EXHAUSTED_JOBS_REPLY;
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }

    const topRankedJobs = orderedRankedPool.map((item) => item.job);
    const focusJob = topRankedJobs[0] ?? null;

    const jobsForLlm = focusJob ? [focusJob] : topRankedJobs;
    const jobAwareDecision = await generateJobAwareReply(
        deps.textCompletion,
        conversation,
        normalizedMessage,
        jobsForLlm.length > 0 ? jobsForLlm : topRankedJobs,
        userAchievements,
        userAccountContext,
        deps.llmObserver
    );
    const validJobIds = validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
    const fallbackPack = applyValidatedJobsFallback(
        topRankedJobs.filter((jobItem) => validJobIds.includes(jobItem.id)).slice(0, 10),
        sanitizeReply(jobAwareDecision.reply),
        focusJob,
        directionHint
    );
    const selectedJob = resolveSelectedJobFromRecommendations(fallbackPack.validatedJobs, validJobIds) ?? focusJob;

    const presentationJobs = topRankedJobs.slice(0, MAX_PRESENTED_JOBS);
    const reply = withJobSelectionClosing(fallbackPack.sanitizedReply, presentationJobs);

    await deps.conversationService.setJobContextAfterSearch(
        userId,
        conversationId,
        topRankedJobs,
        selectedJob,
        queryLabel,
        searchIntent
    );

    const presentedIds = new Set(presentationJobs.map((jobItem) => jobItem.id));
    const jobMatches = rankedJobs
        .filter((item) => presentedIds.has(item.jobId))
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
