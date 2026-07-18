import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../../server.types";
import type { MongoClient } from "../../../mongo/mongo";
import type { ChatRateLimitService } from "../../stage-0-gateway/rate-limit/chat-rate-limit.service";
import type { ChatQueueClient } from "../../stage-0-gateway/queue/chat-queue.client";
import { createChatServiceDependencies } from "../factory/chat-service.factory";
import { ChatRequestHandler } from "../handlers/chat-request.handler";
import { ChatAuthService } from "../middlewares/authentication/chat-auth.service";
import {
    createValidateAuthenticatedChatBody,
    createValidateAuthenticatedChatSession,
} from "../middlewares/authentication/chat-auth.middleware";
import { validateChatMessageBody } from "../middlewares/chat-validation.middleware";
import { ChatRequestRealtimeService } from "../async-jobs/chat-request-realtime.service";
import { ChatRequestRepository } from "../async-jobs/chat-request.repository";
import { ChatRequestService } from "../async-jobs/chat-request.service";

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
    const handler = new ChatRequestHandler(requestService);

    app.post(
        "/chat/message",
        { preHandler: [validateChatMessageBody, createValidateAuthenticatedChatBody(authService, chatConfig.internalServiceApiKey)] },
        handler.submitMessage
    );

    app.get(
        "/chat/requests/:requestId",
        { preHandler: [createValidateAuthenticatedChatSession(authService, chatConfig.internalServiceApiKey)] },
        handler.getRequest
    );

    app.post(
        "/chat/ws-ticket",
        { preHandler: [createValidateAuthenticatedChatSession(authService)] },
        handler.createSocketTicket
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
