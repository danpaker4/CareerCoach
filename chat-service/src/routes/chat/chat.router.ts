import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../server.types";
import { ChatConversationService } from "../conversation/conversation.service";
import { ConversationRepository } from "../conversation/conversation.repository";
import { ChatLlmService } from "./llm/chat.llm.service";
import { ChatValidationService } from "./llm/chat.validation.service";
import { ChatController } from "./chat.controller";
import { ChatExternalService } from "../external-chat/chat.external.service";
import { validateChatMessageBody } from "./chat.middleware";
import { ChatService } from "./chat.service";
import { ConversationStageService } from "../conversation/conversation.stage.service";
import { createTextCompletionPortFromChain } from "../../ai/text-completion.utils";
import { LlmTokenUsageRepository } from "../../ai/token-usage.repository";
import { createEmbeddingPort } from "../../ai/embedding.utils";
import { CareerProfileRepository } from "../career-profile/career-profile.repository";
import { CareerProfileService } from "../career-profile/career-profile.service";
import { ConfidenceService } from "./confidence/confidence.service";
import { ConversationModeService } from "./conversation-mode/conversation-mode.service";
import { AchievementInferenceService } from "./inference/achievement-inference.service";
import { WorkStyleInferenceService } from "./inference/work-style-inference.service";
import { JobSearchPlanService } from "./search/job-search-plan.service";
import { CareerKnowledgeService } from "./knowledge/career-knowledge.service";
import { JobFollowUpIntentService } from "./job-context/job-follow-up-intent.service";
import { JobSelectionResolverService } from "./job-context/job-selection-resolver.service";
import { JobFollowUpAnswerService } from "./job-context/job-follow-up-answer.service";
import { PipelineIntentService } from "./pipeline/pipeline-intent.service";
import { PipelineService } from "./pipeline/pipeline.service";
import type { MongoClient } from "../../mongo/mongo";
import { JobRankingService } from "./ranking/job-ranking.service";

export const chatRouter = (dbClient: MongoClient, chatConfig: ServerConfig["chatConfig"]) => async (app: FastifyInstance) => {
    const repository = new ConversationRepository(dbClient.conversations);
    const tokenUsageRepository = new LlmTokenUsageRepository(dbClient.llmTokenUsage);
    const externalService = new ChatExternalService(chatConfig.usersServiceBaseUrl, chatConfig.jobServiceBaseUrl);
    const stageService = new ConversationStageService();
    const conversationService = new ChatConversationService(repository, externalService, stageService);
    const textCompletion = createTextCompletionPortFromChain(chatConfig.llmTextCompletionChain, tokenUsageRepository);
    const embedding = createEmbeddingPort(chatConfig.llm, chatConfig.embeddingModel, chatConfig.customEmbeddingUrl);
    const llmService = new ChatLlmService(textCompletion);
    const validationService = new ChatValidationService();
    const profileRepository = new CareerProfileRepository(dbClient.careerProfiles);
    const profileService = new CareerProfileService(profileRepository, embedding, {
        notifyProfileMaterialized: (userId) => externalService.notifyCoachProfileMaterialized(userId),
    });
    const confidenceService = new ConfidenceService();
    const modeService = new ConversationModeService();
    const achievementInferenceService = new AchievementInferenceService();
    const workStyleInferenceService = new WorkStyleInferenceService();
    const searchPlanService = new JobSearchPlanService();
    const rankingService = new JobRankingService();
    const followUpIntentService = new JobFollowUpIntentService();
    const selectionResolverService = new JobSelectionResolverService();
    const followUpAnswerService = new JobFollowUpAnswerService();
    const pipelineIntentService = new PipelineIntentService();
    const pipelineService = new PipelineService(chatConfig.jobServiceBaseUrl);
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
        confidenceService,
        modeService,
        achievementInferenceService,
        workStyleInferenceService,
        searchPlanService,
        rankingService,
        knowledgeService,
        followUpIntentService,
        selectionResolverService,
        followUpAnswerService,
        pipelineIntentService,
        pipelineService
    );
    const controller = new ChatController(service);

    app.post("/chat/message", { preHandler: validateChatMessageBody }, controller.sendMessage);
};
