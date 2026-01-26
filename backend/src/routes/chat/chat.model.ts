import { ObjectId } from "mongodb";

export interface ChatMessage {
    role: "user" | "model";
    parts: { text: string }[];
    timestamp: Date;
}

export interface ChatSession {
    _id?: ObjectId;
    userId: string;
    history: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
}