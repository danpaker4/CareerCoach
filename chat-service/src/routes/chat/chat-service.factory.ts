import type { ServerConfig } from "../../server.types";
import { createEmbeddingPort } from "../../ai/embedding.utils";
import { LlmTokenUsageRepository } from "../../ai/token-usage.repository";
import { createTextCompletionPortFromChain } from "../../ai/text-completion.utils";
import type { MongoClient } from "../../mongo/mongo";
import { CareerProfileRepository } from "../career-profile/career-profile.repository";
import { CareerProfileService } from "../career-profile/career-profile.service";
import { ChatConversationService } from "../conversation/conversation.service";
import { ConversationRepository } from "../conversation/conversation.repository";
import { ConversationStageService } from "../conversation/conversation.stage.service";
import { ChatExternalService } from "../external-chat/chat.external.service";
import { ChatService } from "./chat.service";
import { ConfidenceService } from "./confidence/confidence.service";
import { AchievementInferenceService } from "./inference/achievement-inference/achievement-inference.service";
import { SeniorityInferenceService } from "./inference/seniority-inference/seniority-inference.service";
import { JobFollowUpAnswerService } from "./job-follow-up-answer/job-follow-up-answer.service";
import { CareerKnowledgeService } from "./knowledge/career-knowledge.service";
import { ChatLlmService } from "./llm/chat.llm.service";
import { ChatValidationService } from "./llm/chat.validation.service";
import { ConversationModeService } from "./chat-mode/conversation-mode.service";
import { PipelineIntentService } from "./pipeline/pipeline-intent.service";
import { PipelineService } from "./pipeline/pipeline.service";
import { JobRankingService } from "./ranking/job-ranking.service";
import { JobSearchPlanService } from "./search/job-search-plan.service";

export type ChatServiceDependencies = {
    readonly chatService: ChatService;
    readonly conversationService: ChatConversationService;
};

export const createChatServiceDependencies = (
    dbClient: MongoClient,
    chatConfig: ServerConfig["chatConfig"]
): ChatServiceDependencies => {
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
    const seniorityInferenceService = new SeniorityInferenceService();
    const searchPlanService = new JobSearchPlanService();
    const rankingService = new JobRankingService();
    const followUpAnswerService = new JobFollowUpAnswerService();
    const pipelineIntentService = new PipelineIntentService();
    const pipelineService = new PipelineService(chatConfig.jobServiceBaseUrl);
    const knowledgeService = new CareerKnowledgeService(
        dbClient.careerDirectionExamples,
        embedding,
        chatConfig.careerDirectionVectorIndexName
    );

    return {
        conversationService,
        chatService: new ChatService(
            conversationService,
            stageService,
            externalService,
            llmService,
            validationService,
            profileService,
            confidenceService,
            modeService,
            achievementInferenceService,
            seniorityInferenceService,
            searchPlanService,
            rankingService,
            knowledgeService,
            followUpAnswerService,
            pipelineIntentService,
            pipelineService
        ),
    };
};

