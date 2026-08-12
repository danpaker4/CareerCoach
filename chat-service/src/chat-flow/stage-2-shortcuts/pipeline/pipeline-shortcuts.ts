import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { PIPELINE_INTENT } from "./pipeline.consts";
import {
    detectPipelineIntent,
    isAllShortlistedJobsAddIntent,
    isExplicitPipelineAddIntent,
} from "./pipeline-intent.service";
import { handlePipelineAccept, handlePipelineAcceptMany } from "./pipeline-accept/pipeline-accept.service";
import { handlePipelineReject } from "./pipeline-reject/pipeline-reject.service";
import { buildDisambiguationQuestion } from "../follow-up/job-follow-up-answer.service";
import { resolvePipelineJobSelection } from "./pipeline-job-selection/pipeline-job-selection.service";
import { extractPivotDirection } from "../../stage-5-job-search/direction-filters/chat.pivot-direction.utils";
import { runNearTermSearchFlow } from "../near-term/near-term-search-flow";
import { getPresentedPipelineCandidates } from "./pipeline.utils";

const hasShortlistJobs = (ctx: SendMessagePreparedContext): boolean =>
    (ctx.conversationAfterUserMessage.jobContext?.lastReturnedJobs.length ?? 0) > 0;

const isAwaitingPipelineDecision = (ctx: SendMessagePreparedContext): boolean => {
    const jobContext = ctx.conversationAfterUserMessage.jobContext;
    return jobContext?.jobRecommendationContext?.awaitingPipelineDecision === true
        && Boolean(jobContext.selectedJobSnapshot && jobContext.jobRecommendationContext);
};

/** True when we should try pipeline before near-term search. */
export const shouldPrioritizePipelineShortcut = (ctx: SendMessagePreparedContext): boolean => {
    if (!hasShortlistJobs(ctx)) {
        return false;
    }
    if (isAwaitingPipelineDecision(ctx)) {
        return true;
    }
    return isExplicitPipelineAddIntent(ctx.normalizedMessage);
};

export const checkIfNeededAddToPipeline = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    const jobContext = ctx.conversationAfterUserMessage.jobContext;
    if (!jobContext || !hasShortlistJobs(ctx)) {
        return null;
    }

    const awaitingPipelineDecision = isAwaitingPipelineDecision(ctx);
    const pipelineIntent = detectPipelineIntent(ctx.normalizedMessage);
    if (!pipelineIntent) {
        return null;
    }

    // Bare "yes"/"sure" only counts while actively awaiting a decision.
    // Explicit "add … Check Point" still works after the first job was accepted.
    if (pipelineIntent === PIPELINE_INTENT.ACCEPT) {
        if (!awaitingPipelineDecision && !isExplicitPipelineAddIntent(ctx.normalizedMessage)) {
            return null;
        }

        const candidates = getPresentedPipelineCandidates(ctx.conversationAfterUserMessage);
        if (isAllShortlistedJobsAddIntent(ctx.normalizedMessage)) {
            return await handlePipelineAcceptMany({ deps, ctx, jobContext, jobs: candidates });
        }
        const resolution = await resolvePipelineJobSelection({
            textCompletion: deps.textCompletion,
            userMessage: ctx.normalizedMessage,
            candidates,
            focusJobId: jobContext.selectedJobSnapshot?.id ?? null,
            userId: ctx.userId,
        });

        if (resolution.status === "ambiguous") {
            const reply = buildDisambiguationQuestion(resolution.options);
            await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
            return {
                reply,
                mode: ctx.modeDetection.mode,
                confidenceSummary: ctx.confidenceSummary,
            };
        }

        if (resolution.status === "missing") {
            const reply = "I do not have an active job recommendation to add yet. Ask me for roles and I will suggest one.";
            await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
            return {
                reply,
                mode: ctx.modeDetection.mode,
                confidenceSummary: ctx.confidenceSummary,
            };
        }

        const chosenJob = resolution.job;
        const recommendationContext = jobContext.jobRecommendationContext ?? {
            selectedJobId: chosenJob.id,
            selectedJob: chosenJob,
            recommendedJobIds: candidates.map((job) => job.id),
            rejectedJobIds: [],
            acceptedJobIds: [],
            lastRecommendationAt: null,
            awaitingPipelineDecision: false,
        };
        const jobContextForAccept = {
            ...jobContext,
            selectedJobId: chosenJob.id,
            selectedJobSnapshot: chosenJob,
            jobRecommendationContext: recommendationContext,
        };
        return await handlePipelineAccept({ deps, ctx, jobContext: jobContextForAccept });
    }

    if (pipelineIntent === PIPELINE_INTENT.REJECT) {
        if (!awaitingPipelineDecision) {
            return null;
        }
        const pivotDirection = extractPivotDirection(ctx.normalizedMessage);
        if (pivotDirection) {
            console.info(`[CHAT][PIVOT] userId=${ctx.userId} rejected shortlist, searching "${pivotDirection}"`);
            return await runNearTermSearchFlow(deps, ctx, pivotDirection);
        }
        return await handlePipelineReject({ deps, ctx, jobContext });
    }

    return null;
};
