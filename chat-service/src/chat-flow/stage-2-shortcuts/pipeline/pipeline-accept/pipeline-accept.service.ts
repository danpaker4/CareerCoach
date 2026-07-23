import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import { addJobToPipeline } from "./pipeline-accept.api.service";
import type { HandlePipelineAcceptParams } from "./pipeline-accept.types";

export const handlePipelineAccept = async (params: HandlePipelineAcceptParams): Promise<ChatMessageResponse> => {
    const { deps, ctx, jobContext } = params;
    const { userId, conversationId, confidenceSummary } = ctx;
    const mode = ctx.modeDetection.mode;
    const job = jobContext.selectedJobSnapshot;
    const rec = jobContext.jobRecommendationContext;
    if (!job || !rec) {
        const reply = "I do not have an active job recommendation to add yet. Ask me for roles and I will suggest one.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    const result = await addJobToPipeline(deps.jobServiceBaseUrl, userId, job);
    if (result.status === "error") {
        const reply =
            "I could not add that role to your pipeline from here. You can add it from the Jobs page, or tell me if you want to keep exploring other roles.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    const acceptedIds = rec.acceptedJobIds.includes(job.id) ? rec.acceptedJobIds : [...rec.acceptedJobIds, job.id];
    const companyPart = job.company.trim().length > 0 ? ` at ${job.company.trim()}` : "";
    const reply =
        result.status === "already_in_pipeline"
            ? `${job.title}${companyPart} is already in your pipeline — you can track it from My Pipeline. Want to explore another opportunity or prepare for interviews?`
            : `Done — I added the ${job.title} role${companyPart} to your pipeline.\n\nYou can now track it from My Pipeline. Want help preparing for interviews, strengthening a missing skill, or exploring more roles?`;
    const now = new Date();
    const nextContext = {
        ...jobContext,
        jobRecommendationContext: {
            ...rec,
            acceptedJobIds: acceptedIds,
            awaitingPipelineDecision: false,
            lastRecommendationAt: now,
        },
        updatedAt: now,
    };
    await deps.conversationService.saveJobContext(userId, conversationId, nextContext);
    await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
    return { reply, mode, confidenceSummary };
};
