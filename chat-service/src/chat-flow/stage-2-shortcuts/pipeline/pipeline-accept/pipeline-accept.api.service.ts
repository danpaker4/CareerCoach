import type { SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";
import { hashStringToNumber } from "./pipeline-accept.utils";
import type { AddJobToPipelineResult } from "./pipeline-accept.types";

export const addJobToPipeline = async (
    jobServiceBaseUrl: string,
    userId: string,
    job: SanitizedJob
): Promise<AddJobToPipelineResult> => {
    const description = `${job.title} at ${job.company}`.trim();
    const body = {
        userId,
        description,
        jobStage: "wishlist",
        jobId: hashStringToNumber(job.id),
        source: "career_chat",
    };

    const response = await fetch(`${jobServiceBaseUrl}/jobs-in-pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (response.status === 201 || response.status === 200) {
        return { status: "created" };
    }

    if (response.status === 409) {
        return { status: "already_in_pipeline" };
    }

    const errorText = await response.text().catch(() => "");
    return {
        status: "error",
        message: errorText.length > 0 ? errorText : `Pipeline request failed with status ${response.status}`,
    };
};
