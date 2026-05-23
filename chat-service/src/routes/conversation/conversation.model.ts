import { ObjectId } from "mongodb";
import type { ChatMessage } from "../chat/chat.model";
import type { ConversationJobContext } from "../../job-in-conversation.types";

export interface DreamJobFlow {
    proposedTitle?: string;
    awaitingConfirmation: boolean;
}

export interface ConversationStageProgress {
    currentStageIndex: number;
    currentStageId?: string;
    completedStageIds?: string[];
    awaitingConfirmation: boolean;
    stageNotes: Record<string, string[]>;
    surfacedAchievementIds?: string[];
}

export interface Conversation {
    _id?: ObjectId;
    userId: string;
    messages: ChatMessage[];
    jobContext?: ConversationJobContext;
    dreamJobFlow?: DreamJobFlow;
    stageProgress: ConversationStageProgress;
    createdAt: Date;
    updatedAt: Date;
}
