import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { PIPELINE_INTENT } from "./pipeline.consts";
import { detectPipelineIntent } from "./pipeline-intent.service";
import { handlePipelineAccept } from "./pipeline-accept/pipeline-accept.service";
import { handlePipelineReject } from "./pipeline-reject/pipeline-reject.service";

export const checkIfNeededAddToPipeline = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    const jobContext = ctx.conversationAfterUserMessage.jobContext;
    const awaitingPipelineDecision =
        jobContext?.jobRecommendationContext?.awaitingPipelineDecision === true
        && Boolean(jobContext.selectedJobSnapshot && jobContext.jobRecommendationContext);
    const pipelineIntent = awaitingPipelineDecision ? detectPipelineIntent(ctx.normalizedMessage) : null;

    if (pipelineIntent === PIPELINE_INTENT.ACCEPT && jobContext) {
        return await handlePipelineAccept({ deps, ctx, jobContext });
    }

    if (pipelineIntent === PIPELINE_INTENT.REJECT && jobContext) {
        return await handlePipelineReject({ deps, ctx, jobContext });
    }

    return null;
};
