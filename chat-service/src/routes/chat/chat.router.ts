import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../server.types";
import { validateChatMessageBody } from "./chat.middleware";
import { ChatAuthService } from "./chat-auth.service";
import { createValidateAuthenticatedChatBody, createValidateAuthenticatedChatSession } from "./chat-auth.middleware";
import type { MongoClient } from "../../mongo/mongo";
import type { ChatRateLimitService } from "./rate-limit/chat-rate-limit.service";
import { createChatServiceDependencies } from "./chat-service.factory";
import type { ChatQueueClient } from "./queue/chat-queue.client";
import { ChatRequestController } from "./request/chat-request.controller";
import { ChatRequestRepository } from "./request/chat-request.repository";
import { ChatRequestService } from "./request/chat-request.service";
import { ChatRequestRealtimeService } from "./request/chat-request-realtime.service";

export const chatRouter = (
    dbClient: MongoClient,
    chatConfig: ServerConfig["chatConfig"],
    rateLimitService: ChatRateLimitService,
    queueClient: ChatQueueClient,
    realtimeService: ChatRequestRealtimeService
) => async (app: FastifyInstance) => {
    const { conversationService } = createChatServiceDependencies(dbClient, chatConfig);
    const authService = new ChatAuthService(chatConfig.usersServiceBaseUrl);
    const requestRepository = new ChatRequestRepository(dbClient.chatRequests, dbClient.chatSocketTickets);
    const requestService = new ChatRequestService(requestRepository, conversationService, rateLimitService, queueClient);
    const controller = new ChatRequestController(requestService);

    app.post(
        "/chat/message",
        { preHandler: [validateChatMessageBody, createValidateAuthenticatedChatBody(authService, chatConfig.internalServiceApiKey)] },
        controller.submitMessage
    );

    app.get(
        "/chat/requests/:requestId",
        { preHandler: [createValidateAuthenticatedChatSession(authService, chatConfig.internalServiceApiKey)] },
        controller.getRequest
    );

    app.post(
        "/chat/ws-ticket",
        { preHandler: [createValidateAuthenticatedChatSession(authService)] },
        controller.createSocketTicket
    );

    app.get("/chat/ws", { websocket: true }, (socket, request) => {
        const ticket = typeof (request.query as { ticket?: unknown }).ticket === "string"
            ? (request.query as { ticket: string }).ticket
            : "";
        socket.on("message", () => undefined);
        requestService.consumeSocketTicket(ticket)
            .then((userId) => {
                if (!userId) {
                    socket.close(1008, "Invalid socket ticket");
                    return;
                }

                realtimeService.register(userId, socket);
                socket.send(JSON.stringify({ type: "connected" }));
            })
            .catch((error: unknown) => {
                request.log.error({ error }, "Failed opening chat websocket");
                socket.close(1011, "Unable to open chat websocket");
            });
    });
};
