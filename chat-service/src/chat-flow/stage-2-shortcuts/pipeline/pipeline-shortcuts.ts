import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { PIPELINE_INTENT } from "./pipeline.consts";
import { detectPipelineIntent } from "./pipeline-intent.service";
import { handlePipelineAccept } from "./pipeline-accept/pipeline-accept.service";
import { handlePipelineReject } from "./pipeline-reject/pipeline-reject.service";
import { resolveJobSelectionFromFollowUpMessage } from "../follow-up/job-follow-up-answer.utils";
import { extractPivotDirection } from "../../stage-5-job-search/direction-filters/chat.pivot-direction.utils";
import { runNearTermSearchFlow } from "../near-term/near-term-search-flow";

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
        const resolution = resolveJobSelectionFromFollowUpMessage(
            ctx.normalizedMessage,
            null,
            jobContext.lastReturnedJobs
        );
        const chosenJob = resolution.status === "resolved" ? resolution.job : jobContext.selectedJobSnapshot;
        const jobContextForAccept = chosenJob
            ? { ...jobContext, selectedJobId: chosenJob.id, selectedJobSnapshot: chosenJob }
            : jobContext;
        return await handlePipelineAccept({ deps, ctx, jobContext: jobContextForAccept });
    }

    if (pipelineIntent === PIPELINE_INTENT.REJECT && jobContext) {
        const pivotDirection = extractPivotDirection(ctx.normalizedMessage);
        if (pivotDirection) {
            console.info(`[CHAT][PIVOT] userId=${ctx.userId} rejected shortlist, searching "${pivotDirection}"`);
            return await runNearTermSearchFlow(deps, ctx, pivotDirection);
        }
        return await handlePipelineReject({ deps, ctx, jobContext });
    }

    return null;
};
