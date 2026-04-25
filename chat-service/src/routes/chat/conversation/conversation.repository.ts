import type { Collection } from "mongodb";
import type { ChatMessage, UserAchievement } from "../chat/chat.model";
import type { Conversation } from "./conversation.model";

export class ConversationRepository {
    constructor(private readonly conversationsCollection: Collection<Conversation>) {}

    findConversationByUserId = async (userId: string): Promise<Conversation | null> =>
        this.conversationsCollection.findOne({ userId });

    createConversation = async (userId: string, achievements: UserAchievement[], firstAssistantMessage: string): Promise<Conversation> => {
        const now = new Date();
        const conversation: Conversation = {
            userId,
            achievements,
            messages: [{ role: "assistant", content: firstAssistantMessage, timestamp: now }],
            createdAt: now,
            updatedAt: now,
        };

        await this.conversationsCollection.insertOne(conversation);
        return conversation;
    };

    appendMessage = async (userId: string, message: ChatMessage): Promise<void> => {
        await this.conversationsCollection.updateOne(
            { userId },
            {
                $push: { messages: message },
                $set: { updatedAt: new Date() },
            }
        );
    };

    updateAchievements = async (userId: string, achievements: UserAchievement[]): Promise<void> => {
        await this.conversationsCollection.updateOne(
            { userId },
            {
                $set: {
                    achievements,
                    updatedAt: new Date(),
                },
            }
        );
    };
}
