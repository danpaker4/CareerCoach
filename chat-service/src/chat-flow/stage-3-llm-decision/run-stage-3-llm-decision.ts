import type { ChatMessageResponse, ChatTurnDecision, LlmDecision } from "../api/shared/chat.types";
import type { Conversation } from "../../routes/conversation/conversation.model";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";
import { sanitizeReply } from "../stage-6-present-jobs/presentation/chat.validation.service";
import { searchJobsWithBroaderFallback } from "../stage-5-job-search/search-jobs";
import { presentRankedJobs } from "../stage-6-present-jobs/present-jobs";
import { NO_JOBS_REPLY } from "../stage-6-present-jobs/present-jobs.consts";
import { resolveStageFlowForSendMessage } from "../stage-4-guided-stages/resolve-stage-flow";
import { buildWantedJobInputFromSearch } from "../stage-2-shortcuts/wanted-jobs/wanted-job.service";
import { buildWishlistSavePrompt } from "../stage-2-shortcuts/wanted-jobs/chat.wishlist.utils";

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
        `[CHAT][SEARCH] userId=${ctx.userId} trigger=LLM_OR_RULE shouldSearchJobs=${shouldSearchJobs} mode=${ctx.modeDetection.mode} filters=${JSON.stringify(effectiveSearchFilters)}`
    );

    if (!shouldSearchJobs) {
        const sanitized = sanitizeReply(llmDecision.reply);
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, sanitized);
        return { reply: sanitized, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
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
        // No open roles even after broadening — offer to save it to the wishlist (the user
        // confirms before we store anything; on a "yes" we get alerted when one is added).
        const wantedJobInput = buildWantedJobInputFromSearch({
            userId: ctx.userId,
            normalizedMessage: ctx.normalizedMessage,
            searchFilters: effectiveSearchFilters,
        });
        const proposedTitle = wantedJobInput?.jobTitle ?? null;
        const noJobsReply = proposedTitle
            ? buildWishlistSavePrompt(proposedTitle, "I do not have a matching role yet.")
            : NO_JOBS_REPLY;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, noJobsReply);
        return { reply: noJobsReply, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
    }

    return await presentRankedJobs({
        deps,
        ctx,
        jobs,
        conversation: conversationForDecision,
        searchIntent: "SEARCH_PLAN",
        includeRecommendedDirections: true,
    });
};

export const runStage3LlmDecision = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    llmDecision: ChatTurnDecision
): Promise<ChatMessageResponse> => {
    const stageFlow = await resolveStageFlowForSendMessage({
        deps,
        ctx,
        shouldSkipStages: llmDecision.shouldSearchJobs,
        stageDecision: {
            reply: llmDecision.reply,
            shouldAdvanceStage: llmDecision.shouldAdvanceStage,
        },
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
