import type { JobSearchResultItem } from "./chat.types";

export const resolveSelectedJobFromRecommendations = (
    validatedJobs: readonly JobSearchResultItem[],
    validJobIds: readonly string[]
): JobSearchResultItem | null => {
    if (validatedJobs.length === 1) {
        return validatedJobs[0] ?? null;
    }
    if (validJobIds.length === 1) {
        const selectedById = validatedJobs.find((job) => job.id === validJobIds[0]);
        return selectedById ?? null;
    }
    return null;
};
