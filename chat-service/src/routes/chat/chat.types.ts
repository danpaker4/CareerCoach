import type { UserAchievement } from "./chat.model";

export type ConversationResponse = {
    userId: string;
    achievements: UserAchievement[];
    messages: {
        role: "system" | "user" | "assistant";
        content: string;
        timestamp: string;
    }[];
};

export type ChatMessageRequestBody = {
    userId: string;
    message: string;
    userProfile?: {
        firstName?: string;
        lastName?: string;
        currentJob?: string;
        achievements?: UserAchievement[];
    };
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
