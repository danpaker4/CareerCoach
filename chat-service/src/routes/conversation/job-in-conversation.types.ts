export type SanitizedJob = {
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

export type JobRecommendationContextState = {
    selectedJobId: string | null;
    selectedJob: SanitizedJob | null;
    recommendedJobIds: string[];
    rejectedJobIds: string[];
    acceptedJobIds: string[];
    lastRecommendationAt: Date | null;
    awaitingPipelineDecision: boolean;
};

export type ConversationJobContext = {
    lastReturnedJobs: SanitizedJob[];
    selectedJobId: string | null;
    selectedJobSnapshot: SanitizedJob | null;
    lastSearchQuery: string | null;
    lastSearchIntent: string | null;
    lastSearchAt: Date | null;
    updatedAt: Date;
    jobRecommendationContext?: JobRecommendationContextState | null;
};
