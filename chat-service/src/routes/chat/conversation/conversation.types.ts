import type { AttachedJobSnapshot, UserAchievement } from "../chat.model";

export type ConversationRef = {
    userId: string;
    conversationId: string;
};

export type ConversationResponse = {
    conversationId: string;
    userId: string;
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
