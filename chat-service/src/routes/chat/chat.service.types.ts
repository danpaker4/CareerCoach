import type { ConversationStageProgress } from "../conversation/conversation.model";
import type { ConversationMode } from "./chat-mode/conversation-mode.types";
import type { ConfidenceSummary } from "./confidence/confidence.types";
import type { Conversation } from "../conversation/conversation.model";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../external-chat/role-experience.types";
import type { UserAchievement } from "./chat.model";
import type { ProfileInput } from "../conversation/conversation.types";
import type { JobFollowUpIntentResult } from "./job-context/job-follow-up-intent.service";

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
        confidenceSummary: ConfidenceSummary;
    };
