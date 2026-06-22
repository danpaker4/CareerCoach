import type { ProfileInput } from "../conversation/conversation.types";
import type { ConversationStageProgress, Conversation } from "../conversation/conversation.model";
import type { ConversationMode } from "./conversation-mode/conversation-mode.types";
import type { ConfidenceSummary } from "./confidence/confidence.types";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../external-chat/role-experience.types";
import type { SanitizedJob } from "../../job-in-conversation.types";
import type { JobSearchPlanItem } from "./search/job-search-plan.types";
import type { UserAchievement } from "./chat.model";
import type { JobFollowUpIntentResult } from "./job-follow-up-answer/job-follow-up-answer.types";

export type { SanitizedJob };

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
    /** Fallback when Authorization header is not forwarded to chat-service. */
    accessToken?: string;
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

export type DomainExplorationTarget = {
    domain: string;
    keywords: string[];
    roleHints: string[];
    intro: string;
};

export type PrepareSendMessageContextParams = {
    userId: string;
    normalizedMessage: string;
    profile: ProfileInput | undefined;
    requestedConversationId: string | undefined;
    authorization?: string;
};

export type SendMessagePreparedContext = {
    userId: string;
    conversationId: string;
    normalizedMessage: string;
    profile: ProfileInput | undefined;
    userAchievements: UserAchievement[];
    userAccountContext: string;
    conversationAfterUserMessage: Conversation;
    userCareerProfile: UserCareerProfile;
    userRoleExperience: RoleExperienceEntry[];
    confidenceSummary: ConfidenceSummary;
    mode: ConversationMode;
    fastSearchQuery?: string;
    followUpIntent: JobFollowUpIntentResult;
    jobContext: Conversation["jobContext"];
    authorization?: string;
};

export type StageFlowSendMessageResult =
    | { kind: "continue_main_flow"; progress: ConversationStageProgress }
    | {
        kind: "stage_reply_only";
        progress: ConversationStageProgress;
        reply: string;
        mode: ConversationMode;
        confidenceSummary: ConfidenceSummary;
    };
