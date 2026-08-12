import type { ChatMessageResponse } from "../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";
import { CONVERSATION_MODE } from "../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { isNearTermPivotMessage } from "../stage-1-prepare-context/mode-detection/conversation-mode.pivot.utils";
import { runDreamJobFlow } from "./dream-job/dream-job-flow";
import { tryFollowUpShortcutResponse } from "./follow-up/follow-up-shortcut";
import { runNearTermSearchFlow } from "./near-term/near-term-search-flow";
import { tryOfferJobShortcutResponse } from "./offer-job/offer-job-shortcut";
import { tryRejectChoiceResponse } from "./pipeline/pipeline-reject/reject-choice-shortcut";
import { checkIfNeededAddToPipeline, shouldPrioritizePipelineShortcut } from "./pipeline/pipeline-shortcuts";
import { tryQuickHelpShortcutResponse } from "./quick-help/run-quick-help";
import { tryRefineSearchOfferResponse } from "./refine-search/refine-search-shortcut";
import { tryRoleConflictShortcutResponse } from "./role-conflict/role-conflict-shortcut";
import { tryWishlistConfirmationResponse } from "./wanted-jobs/wishlist-shortcut";
import { tryConversationEndResponse } from "./conversation-ending/conversation-ending-shortcut";

const hasShortlistJobs = (ctx: SendMessagePreparedContext): boolean =>
    ((ctx.conversationAfterUserMessage.jobContext?.allReturnedJobs
        ?? ctx.conversationAfterUserMessage.jobContext?.lastReturnedJobs)?.length ?? 0) > 0;

/** Salary/details follow-ups should win over another NEAR_TERM search when jobs are already in context. */
const shouldPrioritizeFollowUpShortcut = (ctx: SendMessagePreparedContext): boolean =>
    hasShortlistJobs(ctx)
    && ctx.followUpIntent.isFollowUp
    && !ctx.followUpIntent.isExplicitNewSearch;

export const runStage2Shortcuts = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    const quickHelpResponse = await tryQuickHelpShortcutResponse(deps, ctx);
    if (quickHelpResponse) {
        return quickHelpResponse;
    }

    const roleConflictResponse = await tryRoleConflictShortcutResponse(deps, ctx);
    if (roleConflictResponse) {
        return roleConflictResponse;
    }

    if (shouldPrioritizePipelineShortcut(ctx)) {
        const pipelineWhileAwaiting = await checkIfNeededAddToPipeline(deps, ctx);
        if (pipelineWhileAwaiting) {
            return pipelineWhileAwaiting;
        }
    }

    if (shouldPrioritizeFollowUpShortcut(ctx)) {
        const followUpResponse = await tryFollowUpShortcutResponse(deps, ctx);
        if (followUpResponse) {
            return followUpResponse;
        }
    }

    const conversationEndResponse = await tryConversationEndResponse(deps, ctx);
    if (conversationEndResponse) {
        return conversationEndResponse;
    }

    const nearTermPivot = isNearTermPivotMessage(ctx.normalizedMessage);
    if (nearTermPivot || (ctx.modeDetection.mode === CONVERSATION_MODE.NEAR_TERM && ctx.modeDetection.shouldSearchJobs)) {
        if (nearTermPivot && ctx.conversationAfterUserMessage.dreamJobFlow) {
            await deps.conversationService.updateDreamJobFlow(ctx.userId, ctx.conversationId, undefined);
        }
        console.info(`[CHAT][NEAR_TERM] userId=${ctx.userId} routing to near-term job search`);
        return await runNearTermSearchFlow(deps, ctx);
    }

    if (ctx.modeDetection.mode === CONVERSATION_MODE.DREAMJOB
        || ctx.conversationAfterUserMessage.dreamJobFlow?.awaitingConfirmation === true
        || ctx.conversationAfterUserMessage.dreamJobFlow?.awaitingTargetYears === true) {
        console.info(`[CHAT][DREAMJOB] userId=${ctx.userId} routing to dream job flow`);
        return await runDreamJobFlow(deps, ctx);
    }

    const wishlistResponse = await tryWishlistConfirmationResponse(deps, ctx);
    if (wishlistResponse) {
        return wishlistResponse;
    }

    const rejectChoiceResponse = await tryRejectChoiceResponse(deps, ctx);
    if (rejectChoiceResponse) {
        return rejectChoiceResponse;
    }

    const offerJobResponse = await tryOfferJobShortcutResponse(deps, ctx);
    if (offerJobResponse) {
        return offerJobResponse;
    }

    const pipelineResponse = await checkIfNeededAddToPipeline(deps, ctx);
    if (pipelineResponse) {
        return pipelineResponse;
    }

    const followUpResponse = await tryFollowUpShortcutResponse(deps, ctx);
    if (followUpResponse) {
        return followUpResponse;
    }

    const refineOfferResponse = await tryRefineSearchOfferResponse(deps, ctx);
    if (refineOfferResponse) {
        return refineOfferResponse;
    }

    return null;
};
