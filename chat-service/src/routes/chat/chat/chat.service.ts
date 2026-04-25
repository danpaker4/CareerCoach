import type { ProfileInput } from "../conversation/conversation.types";
import type { ChatMessageResponse } from "../chat.types";
import { ChatConversationService } from "../conversation/conversation.service";
import { ChatLlmService } from "../llm/chat.llm.service";
import { ChatValidationService } from "../llm/chat.validation.service";
import { ChatExternalService } from "./external-route/chat.external.service";

export class ChatService {
    constructor(
        private readonly conversationService: ChatConversationService,
        private readonly externalService: ChatExternalService,
        private readonly llmService: ChatLlmService,
        private readonly validationService: ChatValidationService
    ) { }

    getConversation = async (userId: string) => this.conversationService.getConversationResponse(userId);

    sendMessage = async (userId: string, message: string, profile?: ProfileInput): Promise<ChatMessageResponse> => {
        const normalizedMessage = message.trim();
        if (normalizedMessage.length === 0) {
            throw new Error("Message is required");
        }

        const profileAchievements = this.conversationService.getProfileAchievements(profile);
        await this.conversationService.ensureConversation(userId, profileAchievements);
        await this.conversationService.appendUserMessage(userId, normalizedMessage);

        const conversationAfterUserMessage = await this.conversationService.ensureConversation(userId, profileAchievements);
        const llmDecision = await this.llmService.decideNextStep(conversationAfterUserMessage, normalizedMessage);

        if (!llmDecision.shouldSearchJobs) {
            const sanitizedReply = this.validationService.sanitizeReply(llmDecision.reply);
            await this.conversationService.appendAssistantMessage(userId, sanitizedReply);
            return { reply: sanitizedReply };
        }

        const jobs = await this.externalService.searchJobs(llmDecision.searchFilters);
        const jobAwareDecision = await this.llmService.generateJobAwareReply(conversationAfterUserMessage, normalizedMessage, jobs);
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
        const validatedJobs = jobs.filter((job) => validJobIds.includes(job.jobId)).slice(0, 10);
        const sanitizedReply = this.validationService.sanitizeReply(jobAwareDecision.reply);

        await this.conversationService.appendAssistantMessage(userId, sanitizedReply);

        return {
            reply: sanitizedReply,
            jobs: validatedJobs,
        };
    };
}
