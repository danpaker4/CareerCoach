import type { ServerConfig } from "../../../server.types";
import { createEmbeddingPort } from "../../../ai/embedding/embedding.utils";
import { LlmTokenUsageDal } from "../../../ai/token-usage/dal/token-usage.dal";
import { createTextCompletionPort } from "../../../litellm/text-completion/text-completion.utils";
import type { MongoClient } from "../../../mongo/mongo";
import { createChatFlow } from "../../chat-flow.factory";
import { createDreamJobRoadmapHttpGenerator } from "../../stage-2-shortcuts/dream-job/chat.dream-job-roadmap-http.service";
import { createDreamJobRoadmapCreator } from "../../stage-2-shortcuts/dream-job/chat.dream-job-roadmap.service";
import { createSuggestDirections } from "../../stage-6-present-jobs/knowledge/career-knowledge.service";
import { CareerProfileDal } from "../../../routes/career-profile/dal/career-profile.dal";
import { CareerProfileService } from "../../../routes/career-profile/career-profile.service";
import { ChatConversationService } from "../../../routes/conversation/conversation.service";
import { ConversationDal } from "../../../routes/conversation/conversation.dal";
import { ChatExternalService } from "../../../routes/external-chat-tools/chat.external.service";
import type { ChatServiceDependencies } from "./chat-service.types";

export const createChatServiceDependencies = (
    dbClient: MongoClient,
    chatConfig: ServerConfig["chatConfig"]
): ChatServiceDependencies => {
    const dal = new ConversationDal(dbClient.conversations);
    const tokenUsageDal = new LlmTokenUsageDal(dbClient.llmTokenUsage);
    const externalService = new ChatExternalService(
        chatConfig.usersServiceBaseUrl,
        chatConfig.jobServiceBaseUrl,
        chatConfig.internalServiceApiKey,
    );
    const conversationService = new ChatConversationService(dal, externalService);
    const textCompletion = createTextCompletionPort(chatConfig.llm, tokenUsageDal);
    const embedding = createEmbeddingPort(chatConfig.customEmbeddingUrl);
    const profileDal = new CareerProfileDal(dbClient.careerProfiles);
    const profileService = new CareerProfileService(profileDal, embedding, textCompletion, {
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
