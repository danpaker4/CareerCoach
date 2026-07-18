import type { ProfileInput } from "../../../routes/conversation/conversation.types";
import type { ConversationMode } from "../../stage-1-prepare-context/mode-detection/conversation-mode.types";
import type { ConfidenceSummary } from "../../stage-1-prepare-context/confidence/confidence.types";
import type { SanitizedJob } from "../../../routes/conversation/job-in-conversation.types";
import type { JobSearchPlanItem } from "../../stage-5-job-search/search-plan/job-search-plan.types";

/** Normalized job shape used across search, LLM, ranking, and persisted job context. */
export type JobSearchResultItem = SanitizedJob;

/** Wire format returned by the job search API before normalization. */
export type RawJobSearchResultItem = {
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
    confidenceSummary?: ConfidenceSummary;
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

export type LlmDecision = {
    reply: string;
    shouldSearchJobs: boolean;
    recommendedJobIds: string[];
    searchFilters: JobSearchRequest;
};

export type StageLlmDecision = {
    reply: string;
    shouldAdvanceStage: boolean;
};
