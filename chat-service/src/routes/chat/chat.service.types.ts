import type { ConversationStageProgress } from "./conversation/conversation.model";
import type { ConversationMode } from "./coach/conversation-mode.types";
import type { CareerConfidenceSummary } from "./coach/career-confidence.types";
import type { Conversation } from "./conversation/conversation.model";
import type { ConversationMemory } from "./memory/conversation-memory.types";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import type { ConversationRef, ProfileInput } from "./conversation/conversation.types";
import type { JobFollowUpIntentResult } from "./job-context/job-follow-up-intent.service";

export type DomainExplorationTarget = {
    domain: string;
    keywords: string[];
    roleHints: string[];
    intro: string;
};

export type SendMessagePreparedContext = {
    ref: ConversationRef;
    userId: string;
    normalizedMessage: string;
    profile: ProfileInput | undefined;
    userAccountContext: string;
    conversationAfterUserMessage: Conversation;
    memories: ConversationMemory[];
    userCareerProfile: UserCareerProfile;
    confidenceSummary: CareerConfidenceSummary;
    mode: ConversationMode;
    followUpIntent: JobFollowUpIntentResult;
    jobContext: Conversation["jobContext"];
};

export type StageFlowSendMessageResult =
    | { kind: "continue_main_flow"; progress: ConversationStageProgress }
    | {
        kind: "stage_reply_only";
        progress: ConversationStageProgress;
        reply: string;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
    };
