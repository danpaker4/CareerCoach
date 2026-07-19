import { randomUUID } from "node:crypto";
import type { ChatConversationService } from "../../../routes/conversation/conversation.service";
import type { ChatMessageRequestBody } from "../shared/chat.types";
import type { ChatQueueClient } from "../../stage-0-gateway/queue/chat-queue.client";
import type { ChatQueueJob } from "../../stage-0-gateway/queue/chat-queue.types";
import type { ChatRateLimitService } from "../../stage-0-gateway/rate-limit/chat-rate-limit.service";
import { withSpan } from "../../../observability/tracing";
import { CHAT_SOCKET_TICKET_TTL_MS } from "./chat-request.consts";
import { ChatRequestDal } from "./chat-request.dal";
import type {
    ChatRequestResponse,
    ChatRequestSubmissionResult,
    ChatSocketTicketResponse,
} from "./chat-request.types";
import { readErrorMessage, toChatRequestResponse, toChatSocketTicketResponse } from "./chat-request.utils";

export class ChatRequestService {
    constructor(
        private readonly dal: ChatRequestDal,
        private readonly conversationService: ChatConversationService,
        private readonly rateLimitService: ChatRateLimitService,
        private readonly queueClient: ChatQueueClient
    ) {}

    submitMessage = async (body: ChatMessageRequestBody, ipAddress: string): Promise<ChatRequestSubmissionResult> => {
        const queueState = {
            queuedRequestsForUser: await this.dal.countQueuedByUserId(body.userId),
            queuedRequestsGlobal: await this.dal.countQueuedGlobal(),
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

        const conversationId = await this.conversationService.getConversationId(body.userId, body.conversationId);
        const requestId = randomUUID();
        const request = await this.dal.createQueuedRequest({
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
            await withSpan("chat.request.enqueue", {
                "chat.request.id": requestId,
                "conversation.id": conversationId,
                "enduser.id": body.userId,
                "messaging.destination.name": "chat.message.requests",
            }, async () => {
                await this.queueClient.publishJob(job);
                await this.queueClient.publishEvent({
                    type: "queued",
                    requestId,
                    userId: body.userId,
                    conversationId,
                    status: "queued",
                });
            });
        } catch (error) {
            await this.dal.markFailed(requestId, readErrorMessage(error));
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
        const request = await this.dal.findByRequestIdAndUserId(requestId, userId);
        return request ? toChatRequestResponse(request) : null;
    };

    createSocketTicket = async (userId: string): Promise<ChatSocketTicketResponse> => {
        const ticket = await this.dal.createSocketTicket(
            randomUUID(),
            userId,
            new Date(Date.now() + CHAT_SOCKET_TICKET_TTL_MS)
        );
        return toChatSocketTicketResponse(ticket);
    };

    consumeSocketTicket = async (ticketId: string): Promise<string | null> => {
        const ticket = await this.dal.consumeSocketTicket(ticketId);
        return ticket?.userId ?? null;
    };
}

