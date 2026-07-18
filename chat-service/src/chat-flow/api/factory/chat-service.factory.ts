import type { ServerConfig } from "../../../server.types";
import { createEmbeddingPort } from "../../../ai/embedding/embedding.utils";
import { LlmTokenUsageRepository } from "../../../ai/token-usage/repository/token-usage.repository";
import { createTextCompletionPort } from "../../../litellm/text-completion/text-completion.utils";
import type { MongoClient } from "../../../mongo/mongo";
import { createChatFlow } from "../../chat-flow.factory";
import { createDreamJobRoadmapHttpGenerator } from "../../stage-2-shortcuts/dream-job/chat.dream-job-roadmap-http.service";
import { createDreamJobRoadmapCreator } from "../../stage-2-shortcuts/dream-job/chat.dream-job-roadmap.service";
import { createSuggestDirections } from "../../stage-6-present-jobs/knowledge/career-knowledge.service";
import { CareerProfileRepository } from "../../../routes/career-profile/career-profile.repository";
import { CareerProfileService } from "../../../routes/career-profile/career-profile.service";
import { ChatConversationService } from "../../../routes/conversation/conversation.service";
import { ConversationRepository } from "../../../routes/conversation/conversation.repository";
import { ChatExternalService } from "../../../routes/external-chat-tools/chat.external.service";
import type { ChatServiceDependencies } from "./chat-service.types";

export const createChatServiceDependencies = (
    dbClient: MongoClient,
    chatConfig: ServerConfig["chatConfig"]
): ChatServiceDependencies => {
    const repository = new ConversationRepository(dbClient.conversations);
    const tokenUsageRepository = new LlmTokenUsageRepository(dbClient.llmTokenUsage);
    const externalService = new ChatExternalService(
        chatConfig.usersServiceBaseUrl,
        chatConfig.jobServiceBaseUrl,
        chatConfig.internalServiceApiKey,
    );
    const conversationService = new ChatConversationService(repository, externalService);
    const textCompletion = createTextCompletionPort(chatConfig.llm, tokenUsageRepository);
    const embedding = createEmbeddingPort(chatConfig.customEmbeddingUrl);
    const profileRepository = new CareerProfileRepository(dbClient.careerProfiles);
    const profileService = new CareerProfileService(profileRepository, embedding, {
        notifyProfileMaterialized: (userId) => externalService.notifyCoachProfileMaterialized(userId),
    });
    const roadmapGenerator = createDreamJobRoadmapHttpGenerator(chatConfig.roadmapServiceBaseUrl);
    const dreamJobRoadmapCreator = createDreamJobRoadmapCreator(roadmapGenerator, externalService);
    const suggestDirections = createSuggestDirections({
        directionCollection: dbClient.careerDirectionExamples,
        embedding,
        directionVectorIndexName: chatConfig.careerDirectionVectorIndexName,
    });

    return {
        conversationService,
        chatFlow: createChatFlow({
            conversationService,
            externalService,
            profileService,
            textCompletion,
            jobServiceBaseUrl: chatConfig.jobServiceBaseUrl,
            dreamJobRoadmapCreator,
            suggestDirections,
        }),
    };
};
