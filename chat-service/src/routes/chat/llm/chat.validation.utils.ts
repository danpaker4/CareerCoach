import type { JobSearchResultItem } from "../chat.types";

export const validateRecommendedJobIds = (
    _reply: string,
    recommendedJobIds: readonly string[],
    availableJobs: readonly JobSearchResultItem[]
): string[] => {
    const availableJobIds = new Set(availableJobs.map((job) => job.id));
    const allMentionedIds = [...new Set(recommendedJobIds)];
    const invalidIds = allMentionedIds.filter((id) => !availableJobIds.has(id));

    if (invalidIds.length > 0) {
        throw new Error(`Invalid recommended jobIds detected: ${invalidIds.join(", ")}`);
    }

    return allMentionedIds;
};
