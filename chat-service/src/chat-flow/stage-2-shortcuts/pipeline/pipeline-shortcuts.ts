import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { PIPELINE_INTENT } from "./pipeline.consts";
import { detectPipelineIntent } from "./pipeline-intent.service";
import { handlePipelineAccept } from "./pipeline-accept/pipeline-accept.service";
import { handlePipelineReject } from "./pipeline-reject/pipeline-reject.service";
import { resolveJobSelectionFromFollowUpMessage } from "../follow-up/job-follow-up-answer.utils";

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
        // Add the specific role the user named ("add the Intel role", "the 2nd one") rather than the
        // top one. The snapshot is passed as null so an explicit ordinal/company in the message wins;
        // when the message names nothing the resolver reports ambiguity and we keep the snapshot.
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
        return await handlePipelineReject({ deps, ctx, jobContext });
    }

    return null;
};
