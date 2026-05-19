import { ObjectId } from "mongodb";
import type { AttachedJobSnapshot, UserAchievement } from "../chat/chat.model";
import type { JobSearchResultItem } from "../chat/chat.types";
import type { Conversation, ConversationStageProgress } from "./conversation.model";
import { CONVERSATION_STAGES } from "./conversation.stage.consts";
import type { ConversationResponse } from "./conversation.types";

export class ConversationNotFoundError extends Error {
    constructor() {
        super("CONVERSATION_NOT_FOUND");
        this.name = "ConversationNotFoundError";
    }
}

export class InvalidConversationIdError extends Error {
    constructor() {
        super("INVALID_CONVERSATION_ID");
        this.name = "InvalidConversationIdError";
    }
}

export const tryParseConversationObjectId = (value: string): ObjectId | null =>
    ObjectId.isValid(value) ? new ObjectId(value) : null;

export const conversationFilter = (userId: string, conversationId: ObjectId): { userId: string; _id: ObjectId } => ({
    userId,
    _id: conversationId,
});

export const toAttachedJobSnapshots = (jobs: readonly JobSearchResultItem[]): AttachedJobSnapshot[] =>
    jobs.map((job) => ({
        jobId: job.id,
        jobTitle: job.title,
        url: job.url,
        seniority: job.seniority,
        description: job.description,
        company: job.company,
        salary: typeof job.salary === "number" ? job.salary : 0,
    }));

export const defaultStageProgress = (): ConversationStageProgress => ({
    currentStageIndex: 0,
    currentStageId: CONVERSATION_STAGES[0]?.id,
    completedStageIds: [],
    awaitingConfirmation: false,
    stageNotes: {},
    surfacedAchievementIds: [],
});

export const appendStageNote = (
    stageProgress: ConversationStageProgress,
    stageId: string,
    note: string
): ConversationStageProgress => {
    const existing = stageProgress.stageNotes[stageId] ?? [];
    return {
        ...stageProgress,
        stageNotes: {
            ...stageProgress.stageNotes,
            [stageId]: [...existing, note],
        },
    };
};

export const parseConversationObjectIdOrThrow = (conversationId: string): ObjectId => {
    const parsed = tryParseConversationObjectId(conversationId);
    if (!parsed) {
        throw new InvalidConversationIdError();
    }
    return parsed;
};

export const toConversationResponse = (
    conversation: Conversation,
    achievements: UserAchievement[],
    currentStageId: string | null,
): ConversationResponse => {
    const conversationId = conversation._id?.toHexString() ?? "";
    return {
        conversationId,
        userId: conversation.userId,
        currentStageId,
        achievements,
        messages: conversation.messages.map((message) => ({
            role: message.role,
            content: message.content,
            timestamp: message.timestamp.toISOString(),
            ...(message.attachedJobs && message.attachedJobs.length > 0 ? { attachedJobs: message.attachedJobs } : {}),
        })),
    };
};
