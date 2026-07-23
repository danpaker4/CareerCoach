import type { Conversation } from "../../routes/conversation/conversation.model";
import type { UserCareerProfile } from "../../routes/career-profile/career-profile.types";
import type { ChatMessageResponse, JobSearchResultItem } from "../api/shared/chat.types";
import { rankJobs } from "./ranking/job-ranking.service";
import {
    applyValidatedJobsFallback,
    mapRankedJobResultToChatMatchRow,
    withPipelineClosing,
} from "./presentation/chat.job-presentation.utils";
import { resolveSelectedJobFromRecommendations } from "./presentation/chat.job-mapping.utils";
import { sanitizeReply, validateRecommendedJobs } from "./presentation/chat.validation.service";
import { generateJobAwareReply } from "../shared/llm/chat.llm.service";
import { EXHAUSTED_JOBS_REPLY } from "./present-jobs.consts";
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

    const { rankedJobs, orderedRankedPool } = filterEligibleRankedJobs(userCareerProfile, jobs, conversation);

    if (orderedRankedPool.length === 0) {
        await deps.conversationService.appendAssistantMessage(userId, conversationId, EXHAUSTED_JOBS_REPLY);
        return { reply: EXHAUSTED_JOBS_REPLY, mode, confidenceSummary };
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
    const sanitizedReply = withPipelineClosing(fallbackPack.sanitizedReply);
    const selectedJob = resolveSelectedJobFromRecommendations(fallbackPack.validatedJobs, validJobIds) ?? focusJob;

    await deps.conversationService.setJobContextAfterSearch(
        userId,
        conversationId,
        topRankedJobs,
        selectedJob,
        queryLabel,
        searchIntent
    );

    const presentationJobs = fallbackPack.validatedJobs.slice(0, 1);
    const primaryJobId = presentationJobs[0]?.id;
    const jobMatches = rankedJobs
        .filter((item) => item.jobId === primaryJobId)
        .map((item) => mapRankedJobResultToChatMatchRow(item));

    const recommendedDirections = includeRecommendedDirections
        ? await deps.suggestDirections(userCareerProfile, userRoleExperience)
        : undefined;

    await deps.conversationService.appendAssistantMessage(userId, conversationId, sanitizedReply, presentationJobs);

    return {
        reply: sanitizedReply,
        jobs: presentationJobs.length > 0 ? presentationJobs : fallbackPack.validatedJobs,
        jobMatches,
        ...(recommendedDirections ? { recommendedDirections } : {}),
        mode,
        confidenceSummary,
    };
};
