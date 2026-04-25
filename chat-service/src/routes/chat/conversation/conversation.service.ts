import type { Conversation } from "./conversation.model";
import type { ConversationResponse, ProfileInput } from "./conversation.types";
import { ChatExternalService } from "../chat/external-route/chat.external.service";
import { ConversationRepository } from "./conversation.repository";
import { formatAchievementsForWelcome, profileToSeedAchievements, toConversationResponse } from "./conversation.utils";

export class ChatConversationService {
    constructor(private readonly repository: ConversationRepository, private readonly chatExternalService: ChatExternalService) {}

    getProfileAchievements = (profile?: ProfileInput): { id: string; name: string; grade: number }[] =>
        profileToSeedAchievements(profile);

    ensureConversation = async (userId: string, profileAchievements?: readonly { id: string; name: string; grade: number }[]): Promise<Conversation> => {
        const existingConversation = await this.repository.findConversationByUserId(userId);
        
        if (existingConversation) {
            
            if (existingConversation.achievements.length === 0 && profileAchievements && profileAchievements.length > 0) {
                await this.repository.updateAchievements(userId, [...profileAchievements]);
                const updatedConversation = await this.repository.findConversationByUserId(userId);
                
                return updatedConversation ?? existingConversation;
            }
        }

        const achievements = profileAchievements && profileAchievements.length > 0
            ? [...profileAchievements]
            : await this.chatExternalService.readUserAchievements(userId);
        const firstAssistantMessage = `Hi! I already know the following achievements:\n${formatAchievementsForWelcome(achievements)}\n\nIs this accurate, or should I update anything before we continue?`;
        
        return this.repository.createConversation(userId, achievements, firstAssistantMessage);
    };

    getConversationResponse = async (userId: string): Promise<ConversationResponse> => {
        const conversation = await this.ensureConversation(userId);
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
}
