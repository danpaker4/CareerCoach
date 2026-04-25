import type { ProfileInput } from "./conversation/conversation.types";

export type ChatMessageRequestBody = {
    userId: string;
    message: string;
    userProfile?: ProfileInput;
};

export type ChatMessageResponse = {
    reply: string;
    jobs?: JobSearchResultItem[];
};

export type UserAchievementResponse = {
    id: string;
    name: string;
    grade: number;
};

export type UserProfileResponse = {
    achievements?: UserAchievementResponse[];
};

export type JobSearchRequest = {
    skills: string[];
    interests: string[];
    experienceLevel: string;
    keywords: string[];
};

export type JobSearchResultItem = {
    jobId: string;
    jobTitle: string;
    url: string;
    seniority: string;
    description: string;
};

export type LlmDecision = {
    reply: string;
    shouldSearchJobs: boolean;
    recommendedJobIds: string[];
    searchFilters: JobSearchRequest;
};

export type { ProfileInput } from "./conversation/conversation.types";
