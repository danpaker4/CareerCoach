import { randomUUID } from "node:crypto";
import type { ChatConversationService } from "../../conversation/conversation.service";
import type { ChatMessageRequestBody } from "../chat.types";
import type { ChatQueueClient } from "../queue/chat-queue.client";
import type { ChatQueueJob } from "../queue/chat-queue.types";
import type { ChatRateLimitService } from "../rate-limit/chat-rate-limit.service";
import { CHAT_SOCKET_TICKET_TTL_MS } from "./chat-request.consts";
import { ChatRequestRepository } from "./chat-request.repository";
import type {
    ChatRequestResponse,
    ChatRequestSubmissionResult,
    ChatSocketTicketResponse,
} from "./chat-request.types";
import { readErrorMessage, toChatRequestResponse, toChatSocketTicketResponse } from "./chat-request.utils";

export class ChatRequestService {
    constructor(
        private readonly repository: ChatRequestRepository,
        private readonly conversationService: ChatConversationService,
        private readonly rateLimitService: ChatRateLimitService,
        private readonly queueClient: ChatQueueClient
    ) {}

    submitMessage = async (body: ChatMessageRequestBody, ipAddress: string): Promise<ChatRequestSubmissionResult> => {
        const queueState = {
            queuedRequestsForUser: await this.repository.countQueuedByUserId(body.userId),
            queuedRequestsGlobal: await this.repository.countQueuedGlobal(),
        };
        const rateLimitDecision = await this.rateLimitService.checkBeforeEnqueue({
            userId: body.userId,
            ipAddress,
            message: body.message,
            queueState,
        });
        if (rateLimitDecision.status === "blocked") {
            return { status: "blocked", decision: rateLimitDecision };
        }

        const { conversationId } = await this.conversationService.ensureConversationExists(body.userId, body.conversationId);
        const requestId = randomUUID();
        const request = await this.repository.createQueuedRequest({
            requestId,
            userId: body.userId,
            conversationId,
            message: body.message,
            ...(body.userProfile ? { userProfile: body.userProfile } : {}),
        });
        const job: ChatQueueJob = {
            requestId,
            userId: body.userId,
            conversationId,
            message: body.message,
            ...(body.userProfile ? { userProfile: body.userProfile } : {}),
        };

        try {
            await this.queueClient.publishJob(job);
            await this.queueClient.publishEvent({
                type: "queued",
                requestId,
                userId: body.userId,
                conversationId,
                status: "queued",
            });
        } catch (error) {
            await this.repository.markFailed(requestId, readErrorMessage(error));
            throw error;
        }

        return {
            status: "queued",
            response: {
                requestId: request.requestId,
                conversationId: request.conversationId,
                status: "queued",
            },
        };
    };

    getRequestForUser = async (requestId: string, userId: string): Promise<ChatRequestResponse | null> => {
        const request = await this.repository.findByRequestIdAndUserId(requestId, userId);
        return request ? toChatRequestResponse(request) : null;
    };

    createSocketTicket = async (userId: string): Promise<ChatSocketTicketResponse> => {
        const ticket = await this.repository.createSocketTicket(
            randomUUID(),
            userId,
            new Date(Date.now() + CHAT_SOCKET_TICKET_TTL_MS)
        );
        return toChatSocketTicketResponse(ticket);
    };

    consumeSocketTicket = async (ticketId: string): Promise<string | null> => {
        const ticket = await this.repository.consumeSocketTicket(ticketId);
        return ticket?.userId ?? null;
    };
}

