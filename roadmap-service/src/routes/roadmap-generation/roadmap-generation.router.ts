import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../server.types";
import type { MongoClient } from "../../mongo/mongo";
import { createTextCompletionPortFromChain } from "../../ai/text-completion.utils";
import { createEmbeddingPort } from "../../ai/embedding.utils";
import { LlmTokenUsageRepository } from "../../ai/token-usage.repository";
import { RoadmapExternalService } from "../external/roadmap.external.service";
import { RoadmapGenerationService } from "./roadmap-generation.service";
import { RoadmapGenerationController } from "./roadmap-generation.controller";

export const roadmapGenerationRouter = (
    dbClient: MongoClient,
    roadmapConfig: ServerConfig["roadmapConfig"]
) =>
    async (app: FastifyInstance) => {
        const tokenUsageRepository = new LlmTokenUsageRepository(dbClient.llmTokenUsage);
        const textCompletion = createTextCompletionPortFromChain(
            roadmapConfig.llmTextCompletionChain,
            tokenUsageRepository
        );
        const embedding = createEmbeddingPort(
            roadmapConfig.llm,
            roadmapConfig.embeddingModel,
            roadmapConfig.customEmbeddingUrl
        );
        const externalService = new RoadmapExternalService(
            roadmapConfig.usersServiceBaseUrl,
            roadmapConfig.jobServiceBaseUrl
        );
        const service = new RoadmapGenerationService(
            textCompletion,
            externalService,
            dbClient.careerDirectionExamples,
            embedding,
            roadmapConfig.careerDirectionVectorIndexName
        );
        const controller = new RoadmapGenerationController(service);

        app.post("/roadmap/generate", controller.generate);
    };
