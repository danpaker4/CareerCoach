import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../../server.types";
import { ChatConversationService } from "../conversation/conversation.service";
import { ConversationRepository } from "../conversation/conversation.repository";
import { ChatLlmService } from "../llm/chat.llm.service";
import { ChatValidationService } from "../llm/chat.validation.service";
import { ChatController } from "./chat.controller";
import { ChatExternalService } from "./external-route/chat.external.service";
import { validateChatMessageBody, validateUserIdParam } from "./chat.middleware";
import { ChatService } from "./chat.service";
import { ConversationStageService } from "../conversation/conversation.stage.service";
import { createTextCompletionPort } from "../../../ai/text-completion.utils";
import { createEmbeddingPort } from "../../../ai/embedding.utils";
import { CareerProfileRepository } from "../career-profile/career-profile.repository";
import { CareerProfileService } from "../career-profile/career-profile.service";
import { ConversationMemoryRepository } from "../memory/conversation-memory.repository";
import { ConversationMemoryService } from "../memory/conversation-memory.service";
import { CareerConfidenceService } from "../coach/career-confidence.service";
import { ConversationModeService } from "../coach/conversation-mode.service";
import { AchievementInferenceService } from "../inference/achievement-inference.service";
import { WorkStyleInferenceService } from "../inference/work-style-inference.service";
import { JobSearchPlanService } from "../search/job-search-plan.service";
import { JobRankingService } from "../ranking/job-ranking.service";
import { CareerKnowledgeService } from "../knowledge/career-knowledge.service";
import { JobFollowUpIntentService } from "../job-context/job-follow-up-intent.service";
import { JobSelectionResolverService } from "../job-context/job-selection-resolver.service";
import { JobFollowUpAnswerService } from "../job-context/job-follow-up-answer.service";
import type { MongoClient } from "../../../mongo/mongo";

export const chatRouter = (dbClient: MongoClient, chatConfig: ServerConfig["chatConfig"]) => async (app: FastifyInstance) => {
    const repository = new ConversationRepository(dbClient.conversations);
    const externalService = new ChatExternalService(chatConfig.usersServiceBaseUrl, chatConfig.jobServiceBaseUrl);
    const stageService = new ConversationStageService();
    const conversationService = new ChatConversationService(repository, externalService, stageService);
    const textCompletion = createTextCompletionPort(chatConfig.llm);
    const embedding = createEmbeddingPort(chatConfig.llm, chatConfig.embeddingModel, chatConfig.customEmbeddingUrl);
    const llmService = new ChatLlmService(textCompletion);
    const validationService = new ChatValidationService();
    const profileRepository = new CareerProfileRepository(dbClient.careerProfiles);
    const memoryRepository = new ConversationMemoryRepository(dbClient.conversationMemories);
    const profileService = new CareerProfileService(profileRepository, embedding);
    const memoryService = new ConversationMemoryService(memoryRepository, embedding, chatConfig.conversationMemoryVectorIndexName);
    const confidenceService = new CareerConfidenceService();
    const modeService = new ConversationModeService();
    const achievementInferenceService = new AchievementInferenceService();
    const workStyleInferenceService = new WorkStyleInferenceService();
    const searchPlanService = new JobSearchPlanService();
    const rankingService = new JobRankingService();
    const followUpIntentService = new JobFollowUpIntentService();
    const selectionResolverService = new JobSelectionResolverService();
    const followUpAnswerService = new JobFollowUpAnswerService();
    const knowledgeService = new CareerKnowledgeService(
        dbClient.careerDirectionExamples,
        embedding,
        chatConfig.careerDirectionVectorIndexName
    );
    const service = new ChatService(
        conversationService,
        stageService,
        externalService,
        llmService,
        validationService,
        profileService,
        memoryService,
        confidenceService,
        modeService,
        achievementInferenceService,
        workStyleInferenceService,
        searchPlanService,
        rankingService,
        knowledgeService,
        followUpIntentService,
        selectionResolverService,
        followUpAnswerService
    );
    const controller = new ChatController(service);

    app.get("/chat/:userId", { preHandler: validateUserIdParam }, controller.getConversation);
    app.post("/chat/message", { preHandler: validateChatMessageBody }, controller.sendMessage);
};
