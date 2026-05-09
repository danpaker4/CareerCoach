import type { FastifyInstance } from "fastify";
import type { Collection } from "mongodb";
import type { Conversation } from "../conversation/conversation.model";
import type { ProfileInput } from "../conversation/conversation.types";
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

export const chatRouter = (conversationsCollection: Collection<Conversation>, chatConfig: ServerConfig["chatConfig"]) => async (app: FastifyInstance) => {
    const repository = new ConversationRepository(conversationsCollection);
    const externalService = new ChatExternalService(chatConfig.usersServiceBaseUrl, chatConfig.jobServiceBaseUrl);
    const stageService = new ConversationStageService();
    const conversationService = new ChatConversationService(repository, externalService, stageService);
    const textCompletion = createTextCompletionPort(chatConfig.llm);
    const llmService = new ChatLlmService(textCompletion);
    const validationService = new ChatValidationService();
    const service = new ChatService(conversationService, stageService, externalService, llmService, validationService);
    const controller = new ChatController(service);

    app.get("/chat/:userId", { preHandler: validateUserIdParam }, controller.getConversation);
    app.post("/chat/message", { preHandler: validateChatMessageBody }, controller.sendMessage);
};
