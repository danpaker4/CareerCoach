import type { AttachedJobSnapshot, UserAchievement } from "../chat/chat.model";

export type ConversationResponse = {
    userId: string;
    achievements: UserAchievement[];
    messages: {
        role: "system" | "user" | "assistant";
        content: string;
        timestamp: string;
        attachedJobs?: AttachedJobSnapshot[];
    }[];
};

export type ProfileInput = {
    firstName?: string;
    lastName?: string;
    currentJob?: string;
    achievements?: UserAchievement[];
    technologies?: string[];
    interests?: string[];
};
