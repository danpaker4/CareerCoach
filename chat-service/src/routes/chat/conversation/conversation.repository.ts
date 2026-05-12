import type { Collection } from "mongodb";
import type { ChatMessage, UserAchievement } from "../chat/chat.model";
import type { Conversation, ConversationStageProgress } from "./conversation.model";
import type { CareerPlanningMode } from "../career-planning/career-planning.types";
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
            careerPlanningMode: "UNKNOWN",
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

    updateCareerPlanningState = async (
        userId: string,
        updates: {
            careerPlanningMode?: CareerPlanningMode;
            careerPlanningDistinctionAskedAt?: Date | null;
        }
    ): Promise<void> => {
        const setDoc: Record<string, unknown> = { updatedAt: new Date() };
        if (updates.careerPlanningMode !== undefined) {
            setDoc.careerPlanningMode = updates.careerPlanningMode;
        }
        if (updates.careerPlanningDistinctionAskedAt !== undefined) {
            if (updates.careerPlanningDistinctionAskedAt === null) {
                setDoc.careerPlanningDistinctionAskedAt = null;
            } else {
                setDoc.careerPlanningDistinctionAskedAt = updates.careerPlanningDistinctionAskedAt;
            }
        }
        if (Object.keys(setDoc).length <= 1) {
            return;
        }
        await this.conversationsCollection.updateOne({ userId }, { $set: setDoc });
    };
}
