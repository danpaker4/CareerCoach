import type { ChatMessageResponse } from "../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";
import { runDreamJobFlow } from "./dream-job/dream-job-flow";
import { tryFollowUpShortcutResponse } from "./follow-up/follow-up-shortcut";
import { tryPipelineShortcutResponse } from "./pipeline/pipeline-shortcuts";

export const runStage2Shortcuts = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    if (ctx.mode === "DREAMJOB") {
        console.info(`[CHAT][DREAMJOB] userId=${ctx.userId} routing to dream job flow`);
        return await runDreamJobFlow(deps, ctx);
    }

    const pipelineResponse = await tryPipelineShortcutResponse(deps, ctx);
    if (pipelineResponse) {
        return pipelineResponse;
    }

    return await tryFollowUpShortcutResponse(deps, ctx);
};
