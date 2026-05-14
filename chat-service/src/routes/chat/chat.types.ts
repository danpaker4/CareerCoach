import type { ProfileInput } from "./conversation/conversation.types";
import type { ConversationMode } from "./coach/conversation-mode.types";
import type { CareerConfidenceSummary } from "./coach/career-confidence.types";
import type { JobSearchPlanItem } from "./search/job-search-plan.types";

export type ChatMessageRequestBody = {
    userId: string;
    message: string;
    /** When set, the message is stored on this conversation thread (must belong to userId). */
    conversationId?: string;
    userProfile?: ProfileInput;
};

export type ChatJobMatchRow = {
    jobId: string;
    title: string;
    matchScore: number;
    matchReasons: string[];
    possibleConcerns: string[];
    missingSkills: string[];
    growthPotential: string;
    whyThisFitsUser: string;
    nextStepSuggestion: string;
};

export type ChatMessageResponse = {
    reply: string;
    jobs?: JobSearchResultItem[];
    jobMatches?: ChatJobMatchRow[];
    recommendedDirections?: Array<{
        directionName: string;
        why: string;
        exampleRoles: string[];
    }>;
    confidenceSummary?: CareerConfidenceSummary;
    mode?: ConversationMode;
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

export type JobSearchPlanRequest = {
    searches: JobSearchPlanItem[];
};

export type JobSearchResultItem = {
    jobId: string;
    jobTitle: string;
    url: string;
    seniority: string;
    description: string;
    company?: string;
    salary?: number;
    requirements?: string[];
    mustKnowSkills?: string[];
    niceToHaveSkills?: string[];
    benefits?: string[];
    location?: string | null;
};

export type LlmDecision = {
    reply: string;
    shouldSearchJobs: boolean;
    recommendedJobIds: string[];
    searchFilters: JobSearchRequest;
};

export type { ProfileInput } from "./conversation/conversation.types";

export type StageLlmDecision = {
    reply: string;
    shouldAdvanceStage: boolean;
};
