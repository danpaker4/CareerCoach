import type { ChatMessageResponse } from "../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";
import { CONVERSATION_MODE } from "../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { runDreamJobFlow } from "./dream-job/dream-job-flow";
import { tryFollowUpShortcutResponse } from "./follow-up/follow-up-shortcut";
import { runNearTermSearchFlow } from "./near-term/near-term-search-flow";
import { tryOfferJobShortcutResponse } from "./offer-job/offer-job-shortcut";
import { checkIfNeededAddToPipeline } from "./pipeline/pipeline-shortcuts";
import { tryQuickHelpShortcutResponse } from "./quick-help/run-quick-help";
import { tryRefineSearchOfferResponse } from "./refine-search/refine-search-shortcut";
import { tryWishlistConfirmationResponse } from "./wanted-jobs/wishlist-shortcut";

export const runStage2Shortcuts = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    // Sticky / new quick-help first so multi-turn flows are not stolen by mode reclassification.
    const quickHelpResponse = await tryQuickHelpShortcutResponse(deps, ctx);
    if (quickHelpResponse) {
        return quickHelpResponse;
    }

    if (ctx.modeDetection.mode === CONVERSATION_MODE.DREAMJOB) {
        console.info(`[CHAT][DREAMJOB] userId=${ctx.userId} routing to dream job flow`);
        return await runDreamJobFlow(deps, ctx);
    }

    const wishlistResponse = await tryWishlistConfirmationResponse(deps, ctx);
    if (wishlistResponse) {
        return wishlistResponse;
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

    if (ctx.modeDetection.mode === CONVERSATION_MODE.NEAR_TERM && ctx.modeDetection.shouldSearchJobs) {
        console.info(`[CHAT][NEAR_TERM] userId=${ctx.userId} mode is ready, routing to near-term job search`);
        return await runNearTermSearchFlow(deps, ctx);
    }

    return null;
};
