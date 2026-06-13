export type JobSearchRequest = {
    skills: string[];
    interests: string[];
    experienceLevel: string;
    keywords: string[];
};

type RawJobSearchResultItem = {
    jobId: string;
    jobTitle: string;
    url: string;
    seniority: string;
    description: string;
    company?: string;
    requirements?: unknown;
    mustKnowSkills?: unknown;
    niceToHaveSkills?: unknown;
    benefits?: unknown;
    salary?: number;
    location?: string | null;
};

export type JobSearchResultItem = {
    id: string;
    title: string;
    company: string;
    seniority: string;
    description: string;
    requirements: string[];
    mustKnowSkills: string[];
    niceToHaveSkills: string[];
    benefits: string[];
    salary: number | null;
    location: string | null;
    url: string;
};

const toStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => item.length > 0)
        : [];

export const normalizeFilters = (filters: JobSearchRequest): JobSearchRequest => ({
    skills: toStringArray(filters.skills),
    interests: toStringArray(filters.interests),
    experienceLevel: typeof filters.experienceLevel === "string" ? filters.experienceLevel : "",
    keywords: toStringArray(filters.keywords),
});

export const isJobSearchResultItem = (value: unknown): value is RawJobSearchResultItem => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const record = value as Record<string, unknown>;
    const companyOk = !("company" in record) || typeof record.company === "string";
    const salaryOk = !("salary" in record) || typeof record.salary === "number";
    const requirementsOk = !("requirements" in record) || Array.isArray(record.requirements);
    const mustKnowSkillsOk = !("mustKnowSkills" in record) || Array.isArray(record.mustKnowSkills);

    return (
        typeof record.jobId === "string" &&
        typeof record.jobTitle === "string" &&
        typeof record.url === "string" &&
        typeof record.seniority === "string" &&
        typeof record.description === "string" &&
        companyOk &&
        salaryOk &&
        requirementsOk &&
        mustKnowSkillsOk
    );
};

export const normalizeJobSearchResultItem = (job: RawJobSearchResultItem): JobSearchResultItem => ({
    id: job.jobId,
    title: job.jobTitle,
    company: job.company ?? "",
    seniority: job.seniority,
    description: job.description,
    requirements: toStringArray(job.requirements),
    mustKnowSkills: toStringArray(job.mustKnowSkills),
    niceToHaveSkills: toStringArray(job.niceToHaveSkills),
    benefits: toStringArray(job.benefits),
    salary: typeof job.salary === "number" ? job.salary : null,
    location: typeof job.location === "string" ? job.location : null,
    url: job.url,
});
