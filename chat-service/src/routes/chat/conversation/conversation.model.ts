import { ObjectId } from "mongodb";
import type { ChatMessage, UserAchievement } from "../chat/chat.model";

export interface ConversationStageProgress {
    currentStageIndex: number;
    awaitingConfirmation: boolean;
    stageNotes: Record<string, string[]>;
    surfacedAchievementIds?: string[];
}

export interface Conversation {
    _id?: ObjectId;
    userId: string;
    achievements: UserAchievement[];
    messages: ChatMessage[];
    stageProgress: ConversationStageProgress;
    createdAt: Date;
    updatedAt: Date;
}
