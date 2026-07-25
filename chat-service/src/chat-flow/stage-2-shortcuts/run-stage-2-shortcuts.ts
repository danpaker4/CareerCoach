import type { ChatMessageResponse } from "../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";
import { CONVERSATION_MODE } from "../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { runDreamJobFlow } from "./dream-job/dream-job-flow";
import { tryFollowUpShortcutResponse } from "./follow-up/follow-up-shortcut";
import { runNearTermSearchFlow } from "./near-term/near-term-search-flow";
import { checkIfNeededAddToPipeline } from "./pipeline/pipeline-shortcuts";

export const runStage2Shortcuts = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    if (ctx.modeDetection.mode === CONVERSATION_MODE.DREAMJOB) {
        console.info(`[CHAT][DREAMJOB] userId=${ctx.userId} routing to dream job flow`);
        return await runDreamJobFlow(deps, ctx);
    }

    const pipelineResponse = await checkIfNeededAddToPipeline(deps, ctx);
    if (pipelineResponse) {
        return pipelineResponse;
    }

    const followUpResponse = await tryFollowUpShortcutResponse(deps, ctx);
    if (followUpResponse) {
        return followUpResponse;
    }

    if (ctx.modeDetection.mode === CONVERSATION_MODE.NEAR_TERM && ctx.modeDetection.shouldSearchJobs) {
        console.info(`[CHAT][NEAR_TERM] userId=${ctx.userId} mode is ready, routing to near-term job search`);
        return await runNearTermSearchFlow(deps, ctx);
    }

    return null;
};
