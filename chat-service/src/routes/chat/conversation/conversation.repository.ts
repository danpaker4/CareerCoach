import type { Collection } from "mongodb";
import { ObjectId } from "mongodb";
import type { ChatMessage, UserAchievement } from "../chat.model";
import type { Conversation, ConversationStageProgress } from "./conversation.model";
import type { ConversationJobContext } from "../job-context/job-context.types";

export type ConversationListRow = {
    _id: ObjectId;
    updatedAt: Date;
    previewText: string;
};

const conversationFilter = (userId: string, conversationId: ObjectId): { userId: string; _id: ObjectId } => ({
    userId,
    _id: conversationId,
});

export class ConversationRepository {
    constructor(private readonly conversationsCollection: Collection<Conversation>) {}

    findByIdAndUserId = async (conversationId: ObjectId, userId: string): Promise<Conversation | null> =>
        this.conversationsCollection.findOne(conversationFilter(userId, conversationId));

    findMostRecentlyUpdatedByUserId = async (userId: string): Promise<Conversation | null> =>
        this.conversationsCollection.findOne({ userId }, { sort: { updatedAt: -1 } });

    listSummariesByUserId = async (userId: string, limit = 50): Promise<ConversationListRow[]> => {
        const cursor = this.conversationsCollection
            .find({ userId })
            .project({ _id: 1, updatedAt: 1, messages: { $slice: -1 } })
            .sort({ updatedAt: -1 })
            .limit(limit);
        const docs = await cursor.toArray();
        return docs.map((doc) => {
            const last = doc.messages?.at(-1);
            const raw = typeof last?.content === "string" ? last.content.trim() : "";
            const previewText = raw.length > 0 ? raw.slice(0, 80) : "New chat";
            return {
                _id: doc._id as ObjectId,
                updatedAt: doc.updatedAt,
                previewText,
            };
        });
    };

    createConversation = async (
        userId: string,
        achievements: UserAchievement[],
        firstAssistantMessage: string,
        stageProgress: ConversationStageProgress
    ): Promise<Conversation> => {
        const now = new Date();
        const conversation: Conversation = {
            userId,
            achievements,
            messages: [{ role: "assistant", content: firstAssistantMessage, timestamp: now }],
            stageProgress,
            createdAt: now,
            updatedAt: now,
        };

        const result = await this.conversationsCollection.insertOne(conversation);
        return { ...conversation, _id: result.insertedId };
    };

    appendMessage = async (userId: string, conversationId: ObjectId, message: ChatMessage): Promise<void> => {
        await this.conversationsCollection.updateOne(conversationFilter(userId, conversationId), {
            $push: { messages: message },
            $set: { updatedAt: new Date() },
        });
    };

    updateAchievements = async (userId: string, conversationId: ObjectId, achievements: UserAchievement[]): Promise<void> => {
        await this.conversationsCollection.updateOne(conversationFilter(userId, conversationId), {
            $set: {
                achievements,
                updatedAt: new Date(),
            },
        });
    };

    updateStageProgress = async (userId: string, conversationId: ObjectId, stageProgress: ConversationStageProgress): Promise<void> => {
        await this.conversationsCollection.updateOne(conversationFilter(userId, conversationId), {
            $set: {
                stageProgress,
                updatedAt: new Date(),
            },
        });
    };

    updateJobContext = async (userId: string, conversationId: ObjectId, jobContext: ConversationJobContext): Promise<void> => {
        await this.conversationsCollection.updateOne(conversationFilter(userId, conversationId), {
            $set: {
                jobContext,
                updatedAt: new Date(),
            },
        });
    };

    deleteByIdAndUserId = async (conversationId: ObjectId, userId: string): Promise<boolean> => {
        const result = await this.conversationsCollection.deleteOne(conversationFilter(userId, conversationId));
        return result.deletedCount === 1;
    };
}
