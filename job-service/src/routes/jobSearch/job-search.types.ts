export type JobSearchRequest = {
    skills: string[];
    interests: string[];
    experienceLevel: string;
    keywords: string[];
};

export type JobSearchResponseItem = {
    jobId: string;
    jobTitle: string;
    url: string;
    seniority: string;
    description: string;
};
