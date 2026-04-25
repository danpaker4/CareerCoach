import { ObjectId } from "mongodb";
import type { ChatMessage, UserAchievement } from "../chat/chat.model";

export interface Conversation {
    _id?: ObjectId;
    userId: string;
    achievements: UserAchievement[];
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
}
