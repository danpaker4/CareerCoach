export type ConversationMemoryType =
    | "preference"
    | "skill"
    | "goal"
    | "dislike"
    | "achievement"
    | "work_style";

export type ConversationMemory = {
    userId: string;
    conversationId: string;
    type: ConversationMemoryType;
    text: string;
    confidence: number;
    evidenceMessageId: string;
    embedding: number[];
    createdAt: Date;
};
