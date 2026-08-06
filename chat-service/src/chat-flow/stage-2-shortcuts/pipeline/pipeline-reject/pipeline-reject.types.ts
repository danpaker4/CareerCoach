import type { JobSearchResultItem } from "../../../api/shared/chat.types";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { UserCareerProfile } from "../../../../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../../../routes/external-chat-tools/role-experience.types";
import type { SanitizedJob, JobRecommendationContextState } from "../../../../routes/conversation/job-in-conversation.types";
import type { ConfidenceSummary } from "../../../stage-1-prepare-context/confidence/confidence.types";
import type { ConversationMode } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";

export type HandlePipelineRejectParams = {
    deps: ChatFlowDeps;
    ctx: SendMessagePreparedContext;
    jobContext: NonNullable<Conversation["jobContext"]>;
};

export type PipelineRejectPresentNextSanitizedJobParams = {
    deps: ChatFlowDeps;
    userId: string;
    conversationId: string;
    jobContext: NonNullable<Conversation["jobContext"]>;
    nextSanitized: SanitizedJob;
    rejectedIds: string[];
    rec: JobRecommendationContextState;
    userCareerProfile: UserCareerProfile;
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
};

export type PipelineRejectFinalizeBroaderRefillParams = {
    deps: ChatFlowDeps;
    conversationId: string;
    userId: string;
    normalizedMessage: string;
    conversation: Conversation;
    jobContext: NonNullable<Conversation["jobContext"]>;
    userCareerProfile: UserCareerProfile;
    rejectedIds: string[];
    rec: JobRecommendationContextState;
    userAccountContext: string;
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
    filteredJobs: JobSearchResultItem[];
    orderedPool: JobSearchResultItem[];
    focusJob: JobSearchResultItem;
};

export type PipelineRejectRunBroaderRefillParams = {
    deps: ChatFlowDeps;
    conversationId: string;
    userId: string;
    normalizedMessage: string;
    conversation: Conversation;
    jobContext: NonNullable<Conversation["jobContext"]>;
    userCareerProfile: UserCareerProfile;
    userRoleExperience: RoleExperienceEntry[];
    rejectedIds: string[];
    rec: JobRecommendationContextState;
    excluded: ReadonlySet<string>;
    userAccountContext: string;
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
};
