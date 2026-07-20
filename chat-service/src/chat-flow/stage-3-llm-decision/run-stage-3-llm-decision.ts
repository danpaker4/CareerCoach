import type { ChatMessageResponse, LlmDecision } from "../api/shared/chat.types";
import type { Conversation } from "../../routes/conversation/conversation.model";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";
import { CONVERSATION_MODE } from "../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { decideNextStep } from "../shared/llm/chat.llm.service";
import { sanitizeReply } from "../stage-6-present-jobs/presentation/chat.validation.service";
import { buildWorkDirectionFilters } from "../stage-5-job-search/direction-filters/chat.direction.utils";
import { searchJobsWithBroaderFallback } from "../stage-5-job-search/search-jobs";
import { presentRankedJobs } from "../stage-6-present-jobs/present-jobs";
import { NO_JOBS_REPLY } from "../stage-6-present-jobs/present-jobs.consts";
import {
    applyValidatedJobsFallback,
    mapRankedJobResultToChatMatchRow,
    withPipelineClosing,
} from "../stage-6-present-jobs/presentation/chat.job-presentation.utils";
import { rankJobs } from "../stage-6-present-jobs/ranking/job-ranking.service";
import { getCurrentStage, recordStageMessage, resolveStageFlowForSendMessage } from "../stage-4-guided-stages/resolve-stage-flow";
import { runDreamJobFlow } from "../stage-2-shortcuts/dream-job/dream-job-flow";

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
        return { reply: fallback, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
    }

    const rankedJobs = rankJobs(ctx.userCareerProfile, jobs, ctx.userRoleExperience);
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
        mode: ctx.mode,
        confidenceSummary: ctx.confidenceSummary,
    };
};

const finalizeSendMessageFromLlmDecision = async (params: {
    deps: ChatFlowDeps;
    ctx: SendMessagePreparedContext;
    conversationForDecision: Conversation;
    llmDecision: LlmDecision;
}): Promise<ChatMessageResponse> => {
    const { deps, ctx, conversationForDecision, llmDecision } = params;
    const effectiveSearchFilters = llmDecision.searchFilters;
    const shouldSearchJobs = llmDecision.shouldSearchJobs;
    console.info(
        `[CHAT][SEARCH] userId=${ctx.userId} trigger=LLM_OR_RULE shouldSearchJobs=${shouldSearchJobs} mode=${ctx.mode} filters=${JSON.stringify(effectiveSearchFilters)}`
    );

    if (!shouldSearchJobs) {
        const sanitized = sanitizeReply(llmDecision.reply);
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, sanitized);
        return { reply: sanitized, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
    }

    const jobs = await searchJobsWithBroaderFallback({
        externalService: deps.externalService,
        userCareerProfile: ctx.userCareerProfile,
        userRoleExperience: ctx.userRoleExperience,
        searchFilters: effectiveSearchFilters,
        userId: ctx.userId,
        trigger: "SEARCH_PLAN",
    });

    if (jobs.length === 0) {
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, NO_JOBS_REPLY);
        return { reply: NO_JOBS_REPLY, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
    }

    return await presentRankedJobs({
        deps,
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        normalizedMessage: ctx.normalizedMessage,
        conversation: conversationForDecision,
        userCareerProfile: ctx.userCareerProfile,
        userRoleExperience: ctx.userRoleExperience,
        jobs,
        userAccountContext: ctx.userAccountContext,
        userAchievements: ctx.userAchievements,
        mode: ctx.mode,
        confidenceSummary: ctx.confidenceSummary,
        queryLabel: ctx.normalizedMessage,
        searchIntent: "SEARCH_PLAN",
        includeRecommendedDirections: true,
    });
};

export const runStage3LlmDecision = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse> => {
    if (ctx.mode === CONVERSATION_MODE.DREAMJOB) {
        console.info(`[CHAT][DREAMJOB] userId=${ctx.userId} routing to dream job flow from mode detection`);
        return await runDreamJobFlow(deps, ctx);
    }

    if (ctx.mode === CONVERSATION_MODE.NEAR_TERM && ctx.modeDetection.shouldSearchJobs) {
        console.info(`[CHAT][NEAR_TERM] userId=${ctx.userId} mode is ready, routing to near-term job search`);
        return await runNearTermSearchFlow(deps, ctx);
    }

    const llmDecision = await decideNextStep(
        deps.textCompletion,
        ctx.conversationAfterUserMessage,
        ctx.normalizedMessage,
        ctx.userAchievements,
        ctx.userAccountContext,
        deps.llmObserver
    );

    const currentStage = getCurrentStage(ctx.conversationAfterUserMessage, ctx.normalizedMessage);
    const stageProgressWithNote = currentStage
        ? recordStageMessage(ctx.conversationAfterUserMessage, ctx.normalizedMessage, currentStage.id)
        : ctx.conversationAfterUserMessage.stageProgress;
    const shouldSkipStages = llmDecision.shouldSearchJobs;
    const stageFlow = await resolveStageFlowForSendMessage({
        deps,
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        normalizedMessage: ctx.normalizedMessage,
        conversationAfterUserMessage: ctx.conversationAfterUserMessage,
        currentStage,
        shouldSkipStages,
        mode: ctx.mode,
        userAccountContext: ctx.userAccountContext,
        userAchievements: ctx.userAchievements,
        stageProgressWithNote,
        confidenceSummary: ctx.confidenceSummary,
    });

    if (stageFlow.kind === "stage_reply_only") {
        return {
            reply: stageFlow.reply,
            mode: stageFlow.mode,
            confidenceSummary: stageFlow.confidenceSummary,
        };
    }

    await deps.conversationService.updateStageProgress(ctx.userId, ctx.conversationId, stageFlow.progress);

    const conversationForDecision = {
        ...ctx.conversationAfterUserMessage,
        stageProgress: stageFlow.progress,
    };

    const updatedAchievements = await deps.externalService
        .upsertAchievementFromUserMessage(ctx.userId, ctx.normalizedMessage, ctx.userAchievements)
        .catch(() => null);

    const ctxForDecision = updatedAchievements ? { ...ctx, userAchievements: updatedAchievements } : ctx;

    return await finalizeSendMessageFromLlmDecision({
        deps,
        ctx: ctxForDecision,
        conversationForDecision,
        llmDecision,
    });
};
