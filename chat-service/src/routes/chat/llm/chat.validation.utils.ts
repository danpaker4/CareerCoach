import type { JobSearchResultItem } from "../chat.types";
import { JOB_ID_REGEX } from "./chat.validation.consts";

const extractJobIdsFromReply = (reply: string): string[] => {
    const extractedIds: string[] = [];
    const matches = reply.matchAll(JOB_ID_REGEX);
    for (const match of matches) {
        const [, id] = match;
        if (id) {
            extractedIds.push(id);
        }
    }
    return extractedIds;
};

export const validateRecommendedJobIds = (
    reply: string,
    recommendedJobIds: readonly string[],
    availableJobs: readonly JobSearchResultItem[]
): string[] => {
    const availableJobIds = new Set(availableJobs.map((job) => job.jobId));
    const extractedFromText = extractJobIdsFromReply(reply);
    const allMentionedIds = [...new Set([...recommendedJobIds, ...extractedFromText])];
    const invalidIds = allMentionedIds.filter((id) => !availableJobIds.has(id));

    if (invalidIds.length > 0) {
        throw new Error(`Invalid recommended jobIds detected: ${invalidIds.join(", ")}`);
    }

    return allMentionedIds;
};
