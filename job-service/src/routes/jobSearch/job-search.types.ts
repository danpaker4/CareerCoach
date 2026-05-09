export type JobSearchRequest = {
    skills: string[];
    interests: string[];
    experienceLevel: string;
    keywords: string[];
};

export type JobSearchStrategyType = "STRICT_MATCH" | "SEMANTIC_PROFILE" | "EXPLORATORY" | "ADJACENT" | "GROWTH_PATH";

export type JobSearchPlanItem = {
    type: JobSearchStrategyType;
    query: string;
    filters: JobSearchRequest;
};

export type JobSearchPlanRequest = {
    searches: JobSearchPlanItem[];
};

export type JobSearchResponseItem = {
    jobId: string;
    jobTitle: string;
    url: string;
    seniority: string;
    description: string;
    company: string;
    salary: number;
    requirements: string[];
    mustKnowSkills: string[];
    niceToHaveSkills: string[];
    benefits: string[];
};
