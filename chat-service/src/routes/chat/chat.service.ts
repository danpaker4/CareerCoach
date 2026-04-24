import type { Conversation } from "./chat.model";
import type { ChatMessageResponse, ConversationResponse } from "./chat.types";
import { ChatExternalService } from "./chat.external.service";
import { ChatLlmService } from "./chat.llm.service";
import { ChatRepository } from "./chat.repository";
import { ChatValidationService } from "./chat.validation.service";

const formatAchievementsForWelcome = (achievements: readonly { name: string; grade: number }[]): string => {
    if (achievements.length === 0) {
        return "I do not have achievements yet. Share your highlights and I will build your profile as we chat.";
    }

    return achievements.map((achievement) => `- ${achievement.name} (grade ${achievement.grade})`).join("\n");
};

const profileToSeedAchievements = (profile?: {
    firstName?: string;
    lastName?: string;
    currentJob?: string;
    achievements?: { id: string; name: string; grade: number }[];
}): { id: string; name: string; grade: number }[] => {
    const profileAchievements = profile?.achievements ?? [];
    if (profileAchievements.length > 0) {
        return profileAchievements;
    }

    if (profile?.currentJob && profile.currentJob.trim()) {
        return [{
            id: "profile-current-job",
            name: `Current job: ${profile.currentJob.trim()}`,
            grade: 70,
        }];
    }

    return [];
};

const toConversationResponse = (conversation: Conversation): ConversationResponse => ({
    userId: conversation.userId,
    achievements: conversation.achievements,
    messages: conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
    })),
});

export class ChatService {
    constructor(
        private readonly repository: ChatRepository,
        private readonly externalService: ChatExternalService,
        private readonly llmService: ChatLlmService,
        private readonly validationService: ChatValidationService
    ) {}

    ensureConversation = async (userId: string, profileAchievements?: readonly { id: string; name: string; grade: number }[]): Promise<Conversation> => {
        const existingConversation = await this.repository.findConversationByUserId(userId);
        if (existingConversation) {
            if (existingConversation.achievements.length === 0 && profileAchievements && profileAchievements.length > 0) {
                await this.repository.updateAchievements(userId, [...profileAchievements]);
                const updatedConversation = await this.repository.findConversationByUserId(userId);
                if (updatedConversation) {
                    return updatedConversation;
                }
            }
            return existingConversation;
        }

        const achievements = profileAchievements && profileAchievements.length > 0
            ? [...profileAchievements]
            : await this.externalService.readUserAchievements(userId);
        const firstAssistantMessage = `Hi! I already know the following achievements:\n${formatAchievementsForWelcome(achievements)}\n\nIs this accurate, or should I update anything before we continue?`;
        return this.repository.createConversation(userId, achievements, firstAssistantMessage);
    };

    getConversation = async (userId: string): Promise<ConversationResponse> => {
        const conversation = await this.ensureConversation(userId);
        return toConversationResponse(conversation);
    };

    sendMessage = async (
        userId: string,
        message: string,
        profile?: {
            firstName?: string;
            lastName?: string;
            currentJob?: string;
            achievements?: { id: string; name: string; grade: number }[];
        }
    ): Promise<ChatMessageResponse> => {
        const normalizedMessage = message.trim();
        if (normalizedMessage.length === 0) {
            throw new Error("Message is required");
        }

        const profileAchievements = profileToSeedAchievements(profile);
        await this.ensureConversation(userId, profileAchievements);
        await this.repository.appendMessage(userId, {
            role: "user",
            content: normalizedMessage,
            timestamp: new Date(),
        });

        const conversationAfterUserMessage = await this.ensureConversation(userId, profileAchievements);
        const llmDecision = await this.llmService.decideNextStep(conversationAfterUserMessage, normalizedMessage);

        if (!llmDecision.shouldSearchJobs) {
            const sanitizedReply = this.validationService.sanitizeReply(llmDecision.reply);
            await this.repository.appendMessage(userId, {
                role: "assistant",
                content: sanitizedReply,
                timestamp: new Date(),
            });
            return { reply: sanitizedReply };
        }

        const jobs = await this.externalService.searchJobs(llmDecision.searchFilters);
        const jobAwareDecision = await this.llmService.generateJobAwareReply(conversationAfterUserMessage, normalizedMessage, jobs);
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
        const validatedJobs = jobs.filter((job) => validJobIds.includes(job.jobId)).slice(0, 10);
        const sanitizedReply = this.validationService.sanitizeReply(jobAwareDecision.reply);

        await this.repository.appendMessage(userId, {
            role: "assistant",
            content: sanitizedReply,
            timestamp: new Date(),
        });

        return {
            reply: sanitizedReply,
            jobs: validatedJobs,
        };
    };
}
