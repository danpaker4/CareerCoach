import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { SanitizedJob } from "../../../routes/conversation/job-in-conversation.types";

export const getPresentedPipelineCandidates = (conversation: Conversation): SanitizedJob[] => {
    const jobContext = conversation.jobContext;
    if (!jobContext) {
        return [];
    }

    const latestPresentedJobIds = [...conversation.messages]
        .reverse()
        .find((message) => message.role === "assistant" && (message.attachedJobs?.length ?? 0) > 0)
        ?.attachedJobs?.map((job) => job.jobId);
    const candidateIds = latestPresentedJobIds ?? jobContext.jobRecommendationContext?.recommendedJobIds;
    if (!candidateIds) {
        return jobContext.lastReturnedJobs;
    }

    const jobsById = new Map(jobContext.lastReturnedJobs.map((job) => [job.id, job]));
    return candidateIds.flatMap((id) => {
        const candidate = jobsById.get(id);
        return candidate ? [candidate] : [];
    });
};
