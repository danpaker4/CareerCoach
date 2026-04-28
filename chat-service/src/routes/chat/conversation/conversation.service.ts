import type { Conversation } from "./conversation.model";
import type { ConversationResponse, ProfileInput } from "./conversation.types";
import { ChatExternalService } from "../chat/external-route/chat.external.service";
import { ConversationRepository } from "./conversation.repository";
import { profileToSeedAchievements, toConversationResponse } from "./conversation.utils";
import { ConversationStageService } from "./conversation.stage.service";

export class ChatConversationService {
    constructor(
        private readonly repository: ConversationRepository,
        private readonly chatExternalService: ChatExternalService,
        private readonly stageService: ConversationStageService
    ) { }

    getProfileAchievements = (profile?: ProfileInput): { id: string; name: string; grade: number }[] =>
        profileToSeedAchievements(profile);

    ensureConversationExists = async (userId: string, profileAchievements?: readonly { id: string; name: string; grade: number }[]): Promise<void> => {
        const existingConversation = await this.repository.findConversationByUserId(userId);
        
        if (existingConversation) {
            
            if (existingConversation.achievements.length === 0 && profileAchievements && profileAchievements.length > 0) {
                await this.repository.updateAchievements(userId, [...profileAchievements]);
            }
            return;
        }

        const achievements = profileAchievements && profileAchievements.length > 0
            ? [...profileAchievements]
            : await this.chatExternalService.readUserAchievements(userId);
        const firstAssistantMessage = this.stageService.getInitialAssistantMessage();
        
        await this.repository.createConversation(
            userId,
            achievements,
            firstAssistantMessage,
            {
                currentStageIndex: 0,
                currentStageId: "achievements",
                completedStageIds: [],
                awaitingConfirmation: false,
                stageNotes: {},
                surfacedAchievementIds: []
            }
        );
    };

    getConversationOrThrow = async (userId: string): Promise<Conversation> => {
        const conversation = await this.repository.findConversationByUserId(userId);
        if (!conversation) {
            throw new Error(`Conversation ${userId} was expected to exist but was not found`);
        }
        return conversation;
    };

    getConversationResponse = async (userId: string): Promise<ConversationResponse> => {
        await this.ensureConversationExists(userId);
        const conversation = await this.getConversationOrThrow(userId);
        return toConversationResponse(conversation);
    };

    appendUserMessage = async (userId: string, content: string): Promise<void> => {
        await this.repository.appendMessage(userId, {
            role: "user",
            content,
            timestamp: new Date(),
        });
    };

    appendAssistantMessage = async (userId: string, content: string): Promise<void> => {
        await this.repository.appendMessage(userId, {
            role: "assistant",
            content,
            timestamp: new Date(),
        });
    };

    updateAchievements = async (
        userId: string,
        achievements: readonly { id: string; name: string; grade: number }[]
    ): Promise<void> => {
        await this.repository.updateAchievements(userId, [...achievements]);
    };

    updateStageProgress = async (
        userId: string,
        stageProgress: Conversation["stageProgress"]
    ): Promise<void> => {
        await this.repository.updateStageProgress(userId, stageProgress);
    };
}
