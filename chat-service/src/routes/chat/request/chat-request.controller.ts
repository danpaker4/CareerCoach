import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ChatMessageRequestBody } from "../chat.types";
import { ConversationNotFoundError, InvalidConversationIdError } from "../../conversation/conversation.utils";
import type { ChatRequestService } from "./chat-request.service";

type ChatRequestParams = {
    readonly requestId?: string;
};

const readRequestIdParam = (request: FastifyRequest): string | null => {
    const params = request.params as ChatRequestParams;
    return typeof params.requestId === "string" && params.requestId.trim().length > 0 ? params.requestId : null;
};

const readAuthenticatedUserId = (request: FastifyRequest): string | null =>
    request.authUser?.userId ?? null;

export class ChatRequestController {
    constructor(private readonly requestService: ChatRequestService) {}

    submitMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.requestService.submitMessage(request.body as ChatMessageRequestBody, request.ip);
            if (result.status === "blocked") {
                reply.status(StatusCodes.TOO_MANY_REQUESTS).send({
                    error: result.decision.error,
                    errorCode: result.decision.errorCode,
                    ...(result.decision.retryAfterMs !== undefined ? { retryAfterMs: result.decision.retryAfterMs } : {}),
                });
                return;
            }

            reply.status(StatusCodes.ACCEPTED).send(result.response);
        } catch (error) {
            if (error instanceof ConversationNotFoundError) {
                reply.status(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
                return;
            }
            if (error instanceof InvalidConversationIdError) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid conversation id" });
                return;
            }

            request.log.error({ error }, "Failed queueing chat message");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed queueing chat message",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    getRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const requestId = readRequestIdParam(request);
        const userId = readAuthenticatedUserId(request);
        if (!requestId || !userId) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "requestId is required" });
            return;
        }

        const chatRequest = await this.requestService.getRequestForUser(requestId, userId);
        if (!chatRequest) {
            reply.status(StatusCodes.NOT_FOUND).send({ error: "Chat request not found" });
            return;
        }

        reply.status(StatusCodes.OK).send(chatRequest);
    };

    createSocketTicket = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const userId = readAuthenticatedUserId(request);
        if (!userId) {
            reply.status(StatusCodes.UNAUTHORIZED).send({ error: "Access token missing" });
            return;
        }

        reply.status(StatusCodes.OK).send(await this.requestService.createSocketTicket(userId));
    };
}

