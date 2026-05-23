import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../server.types";
import type { MongoClient } from "../../mongo/mongo";
import { ChatExternalService } from "../external-chat/chat.external.service";
import { validateUserIdAndConversationIdParams, validateUserIdParam } from "../chat/chat.middleware";
import { ConversationController } from "./conversation.controller";
import { ConversationRepository } from "./conversation.repository";
import { ChatConversationService } from "./conversation.service";
import { ConversationStageService } from "./conversation.stage.service";

export const conversationRouter = (dbClient: MongoClient, chatConfig: ServerConfig["chatConfig"]) => async (app: FastifyInstance) => {
    const repository = new ConversationRepository(dbClient.conversations);
    const externalService = new ChatExternalService(
        chatConfig.usersServiceBaseUrl,
        chatConfig.jobServiceBaseUrl,
        chatConfig.internalServiceApiKey,
    );
    const stageService = new ConversationStageService();
    const conversationService = new ChatConversationService(repository, externalService, stageService);
    const controller = new ConversationController(conversationService);

    app.get("/chat/users/:userId/conversations", { preHandler: validateUserIdParam }, controller.listConversations);
    app.post("/chat/users/:userId/conversations", { preHandler: validateUserIdParam }, controller.createConversation);
    app.delete(
        "/chat/users/:userId/conversations/:conversationId",
        { preHandler: validateUserIdAndConversationIdParams },
        controller.deleteConversation
    );
    app.get("/chat/:userId", { preHandler: validateUserIdParam }, controller.getConversation);
};
