import { ObjectId } from "mongodb";

export interface UserAchievement {
    id: string;
    name: string;
    grade: number;
}

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
    timestamp: Date;
}

export interface Conversation {
    _id?: ObjectId;
    userId: string;
    achievements: UserAchievement[];
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
}