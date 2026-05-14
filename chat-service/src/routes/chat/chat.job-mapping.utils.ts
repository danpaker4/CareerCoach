import type { JobSearchResultItem } from "./chat.types";
import type { SanitizedJob } from "./job-context/job-context.types";

export const resolveSelectedJobFromRecommendations = (
    validatedJobs: readonly JobSearchResultItem[],
    validJobIds: readonly string[]
): JobSearchResultItem | null => {
    if (validatedJobs.length === 1) {
        return validatedJobs[0] ?? null;
    }
    if (validJobIds.length === 1) {
        const selectedById = validatedJobs.find((job) => job.jobId === validJobIds[0]);
        return selectedById ?? null;
    }
    return null;
};

export const sanitizedJobToSearchItem = (job: SanitizedJob): JobSearchResultItem => ({
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    seniority: job.seniority,
    description: job.description,
    url: job.url,
    salary: typeof job.salary === "number" ? job.salary : undefined,
    requirements: job.requirements,
    mustKnowSkills: job.mustKnowSkills,
    niceToHaveSkills: job.niceToHaveSkills,
    benefits: job.benefits,
    location: job.location,
});
