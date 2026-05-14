import { ObjectId } from "mongodb";
import type { ChatMessage, UserAchievement } from "../chat.model";
import type { ConversationJobContext } from "../job-context/job-context.types";

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
    achievements: UserAchievement[];
    messages: ChatMessage[];
    jobContext?: ConversationJobContext;
    stageProgress: ConversationStageProgress;
    createdAt: Date;
    updatedAt: Date;
}
