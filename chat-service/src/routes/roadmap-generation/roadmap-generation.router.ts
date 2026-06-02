import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../server.types";
import type { MongoClient } from "../../mongo/mongo";
import { ChatExternalService } from "../external-chat/chat.external.service";
import { createTextCompletionPortFromChain } from "../../ai/text-completion.utils";
import { createEmbeddingPort } from "../../ai/embedding.utils";
import { LlmTokenUsageRepository } from "../../ai/token-usage.repository";
import { RoadmapGenerationService } from "./roadmap-generation.service";
import { RoadmapGenerationController } from "./roadmap-generation.controller";

export const roadmapGenerationRouter = (
    dbClient: MongoClient,
    chatConfig: ServerConfig["chatConfig"]
) =>
    async (app: FastifyInstance) => {
        const tokenUsageRepository = new LlmTokenUsageRepository(dbClient.llmTokenUsage);
        const textCompletion = createTextCompletionPortFromChain(
            chatConfig.llmTextCompletionChain,
            tokenUsageRepository
        );
        const embedding = createEmbeddingPort(
            chatConfig.llm,
            chatConfig.embeddingModel,
            chatConfig.customEmbeddingUrl
        );
        const externalService = new ChatExternalService(
            chatConfig.usersServiceBaseUrl,
            chatConfig.jobServiceBaseUrl
        );
        const service = new RoadmapGenerationService(
            textCompletion,
            externalService,
            dbClient.careerDirectionExamples,
            embedding,
            chatConfig.careerDirectionVectorIndexName
        );
        const controller = new RoadmapGenerationController(service);

        app.post("/roadmap/generate", controller.generate);
    };
