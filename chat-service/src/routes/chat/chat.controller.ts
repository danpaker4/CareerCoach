import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { resolveRequestAuthorization } from "./chat.authorization.utils";
import type { ChatMessageRequestBody } from "./chat.types";
import { ConversationNotFoundError, InvalidConversationIdError } from "../conversation/conversation.utils";
import type { ChatService } from "./chat.service";
import type { ChatRateLimitService } from "./rate-limit/chat-rate-limit.service";

export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly rateLimitService: ChatRateLimitService
    ) {}

    sendMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const rateLimitDecision = await this.rateLimitService.checkAndAcquire({
            userId: (request.body as ChatMessageRequestBody).userId,
            ipAddress: request.ip,
            message: (request.body as ChatMessageRequestBody).message,
        });
        if (rateLimitDecision.status === "blocked") {
            reply.status(StatusCodes.TOO_MANY_REQUESTS).send({
                error: rateLimitDecision.error,
                errorCode: rateLimitDecision.errorCode,
                ...(rateLimitDecision.retryAfterMs !== undefined ? { retryAfterMs: rateLimitDecision.retryAfterMs } : {}),
            });
            return;
        }

        try {
            const body = request.body as ChatMessageRequestBody;
            const authorization = resolveRequestAuthorization(request.headers.authorization, body.accessToken);
            const response = await this.chatService.sendMessage(
                body.userId,
                body.message,
                body.userProfile,
                body.conversationId,
                authorization
            );
            reply.status(StatusCodes.OK).send(response);
        } catch (error) {
            if (error instanceof Error && error.message === "Message is required") {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: error.message });
                return;
            }
            if (error instanceof ConversationNotFoundError) {
                reply.status(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
                return;
            }
            if (error instanceof InvalidConversationIdError) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid conversation id" });
                return;
            }

            request.log.error({ error }, "Failed sending chat message");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed sending chat message",
                details: error instanceof Error ? error.message : String(error),
            });
        } finally {
            await rateLimitDecision.release().catch((releaseError: unknown) => {
                request.log.error({ error: releaseError }, "Failed releasing chat rate-limit lock");
            });
        }
    };
}
