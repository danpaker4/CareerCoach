import type { Collection } from "mongodb";
import type { EmbeddingPort } from "../ai/embedding/embedding.types";
import type { TextCompletionPort } from "../litellm/text-completion/text-completion.types";
import type { ProfileInput } from "../routes/conversation/conversation.types";
import type { Conversation, ConversationStageProgress } from "../routes/conversation/conversation.model";
import type { ChatConversationService } from "../routes/conversation/conversation.service";
import type { CareerProfileService } from "../routes/career-profile/career-profile.service";
import type { UserCareerProfile } from "../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../routes/external-chat-tools/role-experience.types";
import type { ChatExternalService } from "../routes/external-chat-tools/chat.external.service";
import type { ChatMessageResponse } from "./api/shared/chat.types";
import type { UserAchievement } from "./api/shared/chat.model";
import type { ConversationMode, ConversationModeDetectionResult } from "./stage-1-prepare-context/mode-detection/conversation-mode.types";
import type { ConfidenceSummary } from "./stage-1-prepare-context/confidence/confidence.types";
import type { JobFollowUpIntentResult } from "./stage-2-shortcuts/follow-up/job-follow-up-answer.types";
import type { DreamJobRoadmapCreator } from "./stage-2-shortcuts/dream-job/chat.dream-job-roadmap.types";
import type { CareerDirectionExample, CareerDirectionSuggestion } from "./stage-6-present-jobs/knowledge/career-knowledge.types";
import type { ChatLlmObserver } from "./shared/llm/chat.llm.types";

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
    modeDetection: ConversationModeDetectionResult;
    followUpIntent: JobFollowUpIntentResult;
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

export type SuggestDirections = (
    profile: UserCareerProfile,
    roleExperience?: readonly RoleExperienceEntry[],
    limit?: number
) => Promise<CareerDirectionSuggestion[]>;

export type KnowledgeDeps = {
    readonly directionCollection: Collection<CareerDirectionExample>;
    readonly embedding: EmbeddingPort;
    readonly directionVectorIndexName: string;
};

export type ChatFlowDeps = {
    readonly conversationService: ChatConversationService;
    readonly externalService: ChatExternalService;
    readonly profileService: CareerProfileService;
    readonly textCompletion: TextCompletionPort;
    readonly jobServiceBaseUrl: string;
    readonly dreamJobRoadmapCreator: DreamJobRoadmapCreator;
    readonly suggestDirections: SuggestDirections;
    readonly llmObserver?: ChatLlmObserver;
};

export type SendMessage = (
    userId: string,
    message: string,
    profile?: ProfileInput,
    conversationId?: string,
    authorization?: string
) => Promise<ChatMessageResponse>;

export type ChatFlow = {
    readonly sendMessage: SendMessage;
};
