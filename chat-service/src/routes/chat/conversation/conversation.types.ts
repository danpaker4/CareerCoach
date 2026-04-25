import type { UserAchievement } from "../chat/chat.model";

export type ConversationResponse = {
    userId: string;
    achievements: UserAchievement[];
    messages: {
        role: "system" | "user" | "assistant";
        content: string;
        timestamp: string;
    }[];
};

export type ProfileInput = {
    firstName?: string;
    lastName?: string;
    currentJob?: string;
    achievements?: UserAchievement[];
};
