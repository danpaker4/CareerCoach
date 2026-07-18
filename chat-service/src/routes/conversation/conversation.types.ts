import type { ObjectId } from "mongodb";
import type { AttachedJobSnapshot, ChatMessage, UserAchievement } from "../../chat-flow/api/shared/chat-message.types";
import type { ConversationJobContext } from "./job-in-conversation.types";

export type ConversationStage = {
    id: string;
    objective: string;
};

export type DreamJobFlow = {
    proposedTitle?: string;
    awaitingConfirmation: boolean;
};

export type ConversationStageProgress = {
    currentStageIndex: number;
    currentStageId?: string;
    completedStageIds?: string[];
    awaitingConfirmation: boolean;
    stageNotes: Record<string, string[]>;
    surfacedAchievementIds?: string[];
};

export type Conversation = {
    _id?: ObjectId;
    userId: string;
    messages: ChatMessage[];
    jobContext?: ConversationJobContext;
    dreamJobFlow?: DreamJobFlow;
    stageProgress: ConversationStageProgress;
    createdAt: Date;
    updatedAt: Date;
};

export type EnsureConversationExistsResult = {
    conversationId: string;
};

export type ConversationResponse = {
    conversationId: string;
    userId: string;
    /** Active conversation stage id (`achievements` | `timeline` | `preferences`), aligned with evaluation cases. */
    currentStageId: string | null;
    achievements: UserAchievement[];
    messages: {
        role: "system" | "user" | "assistant";
        content: string;
        timestamp: string;
        attachedJobs?: AttachedJobSnapshot[];
    }[];
};

export type ConversationSummaryResponse = {
    conversationId: string;
    updatedAt: string;
    previewText: string;
};

export type ConversationListRow = {
    _id: ObjectId;
    updatedAt: Date;
    previewText: string;
};

export type ProfileInput = {
    firstName?: string;
    lastName?: string;
    currentJob?: string;
    achievements?: UserAchievement[];
    technologies?: string[];
    interests?: string[];
    /** Skills inferred from GitHub (or passed from the client profile). */
    githubSkills?: string[];
    knownSkills?: string[];
    /** Plain-text CV snippet sent with each message; keep reasonably short on the client. */
    cvExcerpt?: string;
};
