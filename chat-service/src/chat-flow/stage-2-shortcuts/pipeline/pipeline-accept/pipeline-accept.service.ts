import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import type { SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";
import { addJobToPipeline } from "./pipeline-accept.api.service";
import type {
    AddJobToPipelineResult,
    HandlePipelineAcceptManyParams,
    HandlePipelineAcceptParams,
} from "./pipeline-accept.types";
import { buildKeywordsFromTitle } from "../../wanted-jobs/chat.wishlist.utils";
import { WantedJobService } from "../../wanted-jobs/wanted-job.service";
import { isExplicitWishlistAddIntent } from "../pipeline-intent.service";

const activateJobAlert = async (
    jobServiceBaseUrl: string,
    userId: string,
    job: SanitizedJob,
): Promise<boolean> => {
    const service = new WantedJobService(jobServiceBaseUrl);
    const result = await service.create({
        userId,
        jobTitle: job.title,
        keywords: [...new Set([
            ...buildKeywordsFromTitle(job.title),
            ...job.company.toLowerCase().split(/\s+/).filter(Boolean),
        ])],
        ...(job.location ? { location: job.location } : {}),
        ...(job.seniority ? { seniority: job.seniority } : {}),
        rawText: `${job.title} at ${job.company}`.trim(),
    });
    return result.status !== "error";
};

const addJobToPipelineSafely = async (
    jobServiceBaseUrl: string,
    userId: string,
    job: SanitizedJob,
): Promise<AddJobToPipelineResult> => {
    try {
        return await addJobToPipeline(jobServiceBaseUrl, userId, job);
    } catch (error: unknown) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Pipeline request failed",
        };
    }
};

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
    const wantsAlert = isExplicitWishlistAddIntent(ctx.normalizedMessage);
    const alertActivated = wantsAlert
        ? await activateJobAlert(deps.jobServiceBaseUrl, userId, job)
        : false;
    const alertSuffix = wantsAlert
        ? alertActivated
            ? " Alerts are active for matching roles."
            : " I saved it to your pipeline, but couldn't activate matching-role alerts just now."
        : "";
    const reply =
        result.status === "already_in_pipeline"
            ? `${job.title}${companyPart} is already in your pipeline — you can track it from My Pipeline.${alertSuffix} Want to explore another opportunity or prepare for interviews?`
            : `Done — I added the ${job.title} role${companyPart} to your pipeline.${alertSuffix}\n\nYou can now track it from My Pipeline. Want help preparing for interviews, strengthening a missing skill, or exploring more roles?`;
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

export const handlePipelineAcceptMany = async (params: HandlePipelineAcceptManyParams): Promise<ChatMessageResponse> => {
    const { deps, ctx, jobContext } = params;
    const jobs = [...new Map(params.jobs.map((job) => [job.id, job])).values()];
    const results = await Promise.all(
        jobs.map(async (job) => ({ job, result: await addJobToPipelineSafely(deps.jobServiceBaseUrl, ctx.userId, job) })),
    );
    const savedJobs = results.filter(({ result }) => result.status !== "error").map(({ job }) => job);
    const failedCount = jobs.length - savedJobs.length;
    const wantsAlerts = isExplicitWishlistAddIntent(ctx.normalizedMessage);
    const alertResults = wantsAlerts
        ? await Promise.all(savedJobs.map((job) => activateJobAlert(deps.jobServiceBaseUrl, ctx.userId, job)))
        : [];
    const activeAlertCount = alertResults.filter(Boolean).length;
    const savedIds = new Set([
        ...(jobContext.jobRecommendationContext?.acceptedJobIds ?? []),
        ...savedJobs.map((job) => job.id),
    ]);
    const now = new Date();
    const firstJob = jobs[0] ?? null;
    const recommendationContext = jobContext.jobRecommendationContext ?? {
        selectedJobId: firstJob?.id ?? null,
        selectedJob: firstJob,
        recommendedJobIds: jobs.map((job) => job.id),
        rejectedJobIds: [],
        acceptedJobIds: [],
        lastRecommendationAt: null,
        awaitingPipelineDecision: false,
    };
    const nextContext = {
        ...jobContext,
        jobRecommendationContext: {
            ...recommendationContext,
            acceptedJobIds: [...savedIds],
            awaitingPipelineDecision: false,
            lastRecommendationAt: now,
        },
        updatedAt: now,
    };

    if (savedJobs.length > 0) {
        await deps.conversationService.saveJobContext(ctx.userId, ctx.conversationId, nextContext);
    }

    const alertStatus = wantsAlerts
        ? activeAlertCount === savedJobs.length
            ? " Alerts are active for matching roles."
            : ` Alerts are active for ${activeAlertCount} of ${savedJobs.length} saved roles.`
        : "";
    const destination = wantsAlerts ? "pipeline wishlist" : "pipeline";
    const reply = failedCount === 0
        ? `Done — I added all ${savedJobs.length} roles to your ${destination}.${alertStatus} You can track them from My Pipeline.`
        : savedJobs.length === 0
            ? `I couldn't add those roles to your ${destination} just now. Please try again.`
            : `I added ${savedJobs.length} of ${jobs.length} roles to your ${destination}, but ${failedCount} could not be added.${alertStatus} You can track the saved roles from My Pipeline.`;
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return {
        reply,
        mode: ctx.modeDetection.mode,
        confidenceSummary: ctx.confidenceSummary,
    };
};
