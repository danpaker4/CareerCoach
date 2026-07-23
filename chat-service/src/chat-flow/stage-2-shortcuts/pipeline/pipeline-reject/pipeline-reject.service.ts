import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import { buildBroaderJobSearchFilters } from "../../../stage-5-job-search/direction-filters/chat.direction.utils";
import { buildBroaderJobSearchPlan } from "../../../stage-5-job-search/search-plan/job-search-plan.service";
import { rankJobs } from "../../../stage-6-present-jobs/ranking/job-ranking.service";
import {
    applyValidatedJobsFallback,
    mapRankedJobResultToChatMatchRow,
    withPipelineClosing,
} from "../../../stage-6-present-jobs/presentation/chat.job-presentation.utils";
import { sanitizeReply, validateRecommendedJobs } from "../../../stage-6-present-jobs/presentation/chat.validation.service";
import { generateJobAwareReply } from "../../../shared/llm/chat.llm.service";
import type {
    HandlePipelineRejectParams,
    PipelineRejectFinalizeBroaderRefillParams,
    PipelineRejectPresentNextSanitizedJobParams,
    PipelineRejectRunBroaderRefillParams,
} from "./pipeline-reject.types";

const pipelineRejectPresentNextSanitizedJob = async (
    params: PipelineRejectPresentNextSanitizedJobParams
): Promise<ChatMessageResponse> => {
    const {
        deps, userId, conversationId, jobContext, nextSanitized, rejectedIds, rec,
        userCareerProfile, mode, confidenceSummary,
    } = params;
    const ranked = rankJobs(userCareerProfile, [nextSanitized]);
    const top = ranked[0];
    const reasonsText = top.reasons.join(" ");
    const reply = withPipelineClosing(
        `No problem. Another role that may fit is:\n${nextSanitized.title} — ${nextSanitized.company}\n\n${reasonsText}`
    );
    const now = new Date();
    const nextContext = {
        ...jobContext,
        selectedJobId: nextSanitized.id,
        selectedJobSnapshot: nextSanitized,
        jobRecommendationContext: {
            ...rec,
            rejectedJobIds: rejectedIds,
            selectedJobId: nextSanitized.id,
            selectedJob: nextSanitized,
            awaitingPipelineDecision: true,
            lastRecommendationAt: now,
        },
        updatedAt: now,
    };
    await deps.conversationService.saveJobContext(userId, conversationId, nextContext);
    const jobMatches = [mapRankedJobResultToChatMatchRow(top)];
    await deps.conversationService.appendAssistantMessage(userId, conversationId, reply, [nextSanitized]);
    return { reply, jobs: [nextSanitized], jobMatches, mode, confidenceSummary };
};

const pipelineRejectFinalizeBroaderRefill = async (
    params: PipelineRejectFinalizeBroaderRefillParams
): Promise<ChatMessageResponse> => {
    const {
        deps, conversationId, userId, conversation, jobContext, userCareerProfile,
        rejectedIds, rec, userAccountContext, mode, confidenceSummary,
        filteredJobs, orderedPool, focusJob,
    } = params;
    const userAchievements = await deps.externalService.readUserAchievements(userId);
    const jobAwareDecision = await generateJobAwareReply(
        deps.textCompletion,
        conversation,
        "Show another role",
        [focusJob],
        userAchievements,
        userAccountContext,
        deps.llmObserver
    );
    const validJobIds = validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, filteredJobs);
    const validatedAfterFallback = applyValidatedJobsFallback(
        orderedPool.filter((j) => validJobIds.includes(j.id)).slice(0, 10),
        sanitizeReply(jobAwareDecision.reply),
        focusJob
    );
    const selectedJob = validatedAfterFallback.validatedJobs[0] ?? focusJob;
    const queryLabel = jobContext.lastSearchQuery ?? "your direction";
    await deps.conversationService.saveJobContext(userId, conversationId, {
        ...jobContext,
        jobRecommendationContext: {
            ...rec,
            rejectedJobIds: rejectedIds,
        },
        updatedAt: new Date(),
    });
    await deps.conversationService.setJobContextAfterSearch(
        userId,
        conversationId,
        orderedPool,
        selectedJob,
        queryLabel,
        "BROADER_PIPELINE_REFILL"
    );
    const presentationJobs = [selectedJob];
    const rankedForMatches = rankJobs(userCareerProfile, presentationJobs);
    const jobMatches = rankedForMatches.map((item) => mapRankedJobResultToChatMatchRow(item));
    const reply = withPipelineClosing(validatedAfterFallback.sanitizedReply);
    await deps.conversationService.appendAssistantMessage(userId, conversationId, reply, presentationJobs);
    return {
        reply,
        jobs: presentationJobs,
        jobMatches,
        mode,
        confidenceSummary,
    };
};

const pipelineRejectRunBroaderRefill = async (
    params: PipelineRejectRunBroaderRefillParams
): Promise<ChatMessageResponse> => {
    const {
        deps, userId, conversationId, normalizedMessage, conversation, jobContext,
        userCareerProfile, userRoleExperience, rejectedIds, rec, excluded,
        userAccountContext, mode, confidenceSummary,
    } = params;
    const broaderFilters = buildBroaderJobSearchFilters(jobContext, userCareerProfile);
    const broaderPlan = buildBroaderJobSearchPlan(userCareerProfile, broaderFilters, userRoleExperience);
    const searchedJobs = await deps.externalService.searchJobsByPlan(broaderPlan);
    const filteredJobs = searchedJobs.filter((j) => !excluded.has(j.id));
    if (filteredJobs.length === 0) {
        const reply =
            "I do not have another stored match right now, and a broader search did not surface a new role yet. Try naming a nearby title or domain you are curious about, and I will search again.";
        const now = new Date();
        await deps.conversationService.saveJobContext(userId, conversationId, {
            ...jobContext,
            jobRecommendationContext: {
                ...rec,
                rejectedJobIds: rejectedIds,
                awaitingPipelineDecision: false,
                lastRecommendationAt: now,
            },
            updatedAt: now,
        });
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    const rankedJobs = rankJobs(userCareerProfile, filteredJobs);
    const orderedPool = rankedJobs.slice(0, 15).map((item) => item.job);
    const focusJob = orderedPool[0] ?? null;
    if (!focusJob) {
        const reply = "I could not find another role to suggest yet. Tell me a role family or skill area to lean into, and I will search again.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    return await pipelineRejectFinalizeBroaderRefill({
        deps,
        userId,
        conversationId,
        normalizedMessage,
        conversation,
        jobContext,
        userCareerProfile,
        rejectedIds,
        rec,
        userAccountContext,
        mode,
        confidenceSummary,
        filteredJobs,
        orderedPool,
        focusJob,
    });
};

export const handlePipelineReject = async (params: HandlePipelineRejectParams): Promise<ChatMessageResponse> => {
    const { deps, ctx, jobContext } = params;
    const {
        userId,
        conversationId,
        normalizedMessage,
        conversationAfterUserMessage: conversation,
        userCareerProfile,
        userRoleExperience,
        confidenceSummary,
        userAccountContext,
    } = ctx;
    const mode = ctx.modeDetection.mode;
    const job = jobContext.selectedJobSnapshot;
    const rec = jobContext.jobRecommendationContext;
    if (!job || !rec) {
        const reply = "I do not have an active job recommendation to skip. Ask me for roles and I will suggest one.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    const rejectedIds = rec.rejectedJobIds.includes(job.id) ? rec.rejectedJobIds : [...rec.rejectedJobIds, job.id];
    const excluded = new Set([...rejectedIds, ...rec.acceptedJobIds]);
    const nextJobId = rec.recommendedJobIds.find((id) => !excluded.has(id));
    const nextSanitized = nextJobId ? jobContext.lastReturnedJobs.find((j) => j.id === nextJobId) ?? null : null;

    if (nextSanitized) {
        return await pipelineRejectPresentNextSanitizedJob({
            deps,
            conversationId,
            userId,
            jobContext,
            nextSanitized,
            rejectedIds,
            rec,
            userCareerProfile,
            mode,
            confidenceSummary,
        });
    }

    return await pipelineRejectRunBroaderRefill({
        deps,
        conversationId,
        userId,
        normalizedMessage,
        conversation,
        jobContext,
        userCareerProfile,
        userRoleExperience,
        rejectedIds,
        rec,
        excluded,
        userAccountContext,
        mode,
        confidenceSummary,
    });
};
