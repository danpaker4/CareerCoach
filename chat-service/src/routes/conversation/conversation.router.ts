import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../server.types";
import type { MongoClient } from "../../mongo/mongo";
import { ChatAuthService } from "../../chat-flow/api/middlewares/authentication/chat-auth.service";
import { createValidateAuthenticatedChatParams } from "../../chat-flow/api/middlewares/authentication/chat-auth.middleware";
import { ChatExternalService } from "../external-chat-tools/chat.external.service";
import { validateUserIdAndConversationIdParams, validateUserIdParam } from "../../chat-flow/api/middlewares/chat-validation.middleware";
import { ConversationController } from "./conversation.controller";
import { ConversationDal } from "./conversation.dal";
import { ChatConversationService } from "./conversation.service";

export const conversationRouter = (dbClient: MongoClient, chatConfig: ServerConfig["chatConfig"]) => async (app: FastifyInstance) => {
    const dal = new ConversationDal(dbClient.conversations);
    const externalService = new ChatExternalService(
        chatConfig.usersServiceBaseUrl,
        chatConfig.jobServiceBaseUrl,
        chatConfig.internalServiceApiKey,
    );
    const authService = new ChatAuthService(chatConfig.usersServiceBaseUrl);
    const validateAuthenticatedUser = createValidateAuthenticatedChatParams(authService, chatConfig.internalServiceApiKey);
    const conversationService = new ChatConversationService(dal, externalService);
    const controller = new ConversationController(conversationService);

    app.get(
        "/chat/users/:userId/conversations",
        { preHandler: [validateUserIdParam, validateAuthenticatedUser] },
        controller.listConversations
    );
    app.post(
        "/chat/users/:userId/conversations",
        { preHandler: [validateUserIdParam, validateAuthenticatedUser] },
        controller.createConversation
    );
    app.delete(
        "/chat/users/:userId/conversations/:conversationId",
        { preHandler: [validateUserIdAndConversationIdParams, validateAuthenticatedUser] },
        controller.deleteConversation
    );
    app.get("/chat/:userId", { preHandler: [validateUserIdParam, validateAuthenticatedUser] }, controller.getConversation);
};
