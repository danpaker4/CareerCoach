import type { ProfileInput } from "../conversation/conversation.types";
import type { ChatMessageResponse } from "../chat.types";
import { ChatConversationService } from "../conversation/conversation.service";
import { ConversationStageService } from "../conversation/conversation.stage.service";
import { ChatLlmService } from "../llm/chat.llm.service";
import { ChatValidationService } from "../llm/chat.validation.service";
import { ChatExternalService } from "./external-route/chat.external.service";

export class ChatService {
    constructor(
        private readonly conversationService: ChatConversationService,
        private readonly stageService: ConversationStageService,
        private readonly externalService: ChatExternalService,
        private readonly llmService: ChatLlmService,
        private readonly validationService: ChatValidationService
    ) { }

    getConversation = async (userId: string) => this.conversationService.getConversationResponse(userId);

    private isStageSkipRequested = (message: string): boolean => {
        const normalized = message.toLowerCase();
        const skipSignals = [
            "skip stage",
            "skip to jobs",
            "jump to jobs",
            "show me jobs",
            "find jobs now",
            "go to final stage",
        ];
        return skipSignals.some((signal) => normalized.includes(signal));
    };

    sendMessage = async (userId: string, message: string, profile?: ProfileInput): Promise<ChatMessageResponse> => {
        const normalizedMessage = message.trim();
        if (normalizedMessage.length === 0) {
            throw new Error("Message is required");
        }

        // get profile achievements
        const profileAchievements = this.conversationService.getProfileAchievements(profile);
        // ensure conversation exists
        await this.conversationService.ensureConversationExists(userId, profileAchievements);
        await this.conversationService.appendUserMessage(userId, normalizedMessage);

        // get conversation after user message
        const conversationAfterUserMessage = await this.conversationService.getConversationOrThrow(userId);
        const currentStage = this.stageService.getCurrentStage(conversationAfterUserMessage, normalizedMessage);
        const stageProgressWithNote = currentStage
            ? this.stageService.recordStageMessage(conversationAfterUserMessage, normalizedMessage, currentStage.id)
            : conversationAfterUserMessage.stageProgress;
        const shouldSkipStages = this.isStageSkipRequested(normalizedMessage);
        let stageProgressForNextFlow = shouldSkipStages
            ? this.stageService.completeAllStages(stageProgressWithNote)
            : stageProgressWithNote;

        if (currentStage && !shouldSkipStages) {
            const stageReply = await this.llmService.generateStageReply(conversationAfterUserMessage, normalizedMessage, currentStage);
            const nextStageProgress = this.stageService.applyStageAdvance(stageProgressWithNote, currentStage.id, stageReply.shouldAdvanceStage);
            await this.conversationService.updateStageProgress(userId, nextStageProgress);
            stageProgressForNextFlow = nextStageProgress;

            const conversationAfterStageAdvance = {
                ...conversationAfterUserMessage,
                stageProgress: nextStageProgress,
            };
            const nextStage = this.stageService.getCurrentStage(conversationAfterStageAdvance, normalizedMessage);
            if (nextStage) {
                await this.conversationService.appendAssistantMessage(userId, stageReply.reply);
                return { reply: stageReply.reply };
            }
        }

        await this.conversationService.updateStageProgress(userId, stageProgressForNextFlow);

        const conversationForDecision = {
            ...conversationAfterUserMessage,
            stageProgress: stageProgressForNextFlow,
        };

        // upsert achievement from user message
        const updatedAchievements = await this.externalService.upsertAchievementFromUserMessage(
            userId,
            normalizedMessage,
            conversationForDecision.achievements
        ).catch(() => null);

        if (updatedAchievements) {
            await this.conversationService.updateAchievements(userId, updatedAchievements);
        }

        const llmDecision = await this.llmService.decideNextStep(conversationForDecision, normalizedMessage);

        if (!llmDecision.shouldSearchJobs) {
            const sanitizedReply = this.validationService.sanitizeReply(llmDecision.reply);
            await this.conversationService.appendAssistantMessage(userId, sanitizedReply);
            return { reply: sanitizedReply };
        }

        const jobs = await this.externalService.searchJobs(llmDecision.searchFilters);
        const jobAwareDecision = await this.llmService.generateJobAwareReply(conversationForDecision, normalizedMessage, jobs);
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
