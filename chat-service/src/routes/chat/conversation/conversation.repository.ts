import type { Collection } from "mongodb";
import type { ChatMessage, UserAchievement } from "../chat/chat.model";
import type { CareerHorizon, Conversation, ConversationStageProgress } from "./conversation.model";
import type { ConversationJobContext } from "../job-context/job-context.types";

export class ConversationRepository {
    constructor(private readonly conversationsCollection: Collection<Conversation>) {}

    findConversationByUserId = async (userId: string): Promise<Conversation | null> =>
        this.conversationsCollection.findOne({ userId });

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

    updateStageProgress = async (userId: string, stageProgress: ConversationStageProgress): Promise<void> => {
        await this.conversationsCollection.updateOne(
            { userId },
            {
                $set: {
                    stageProgress,
                    updatedAt: new Date(),
                },
            }
        );
    };

    updateJobContext = async (userId: string, jobContext: ConversationJobContext): Promise<void> => {
        await this.conversationsCollection.updateOne(
            { userId },
            {
                $set: {
                    jobContext,
                    updatedAt: new Date(),
                },
            }
        );
    };

    updateCareerHorizon = async (userId: string, careerHorizon: CareerHorizon): Promise<void> => {
        await this.conversationsCollection.updateOne(
            { userId },
            {
                $set: {
                    careerHorizon,
                    updatedAt: new Date(),
                },
            }
        );
    };

    setLongTermCapturedDreamJobTitle = async (userId: string, title: string): Promise<void> => {
        await this.conversationsCollection.updateOne(
            { userId },
            {
                $set: {
                    longTermCapturedDreamJobTitle: title,
                    updatedAt: new Date(),
                },
            }
        );
    };
}
