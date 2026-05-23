import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { resolveRequestAuthorization } from "./chat.authorization.utils";
import type { ChatMessageRequestBody } from "./chat.types";
import { ConversationNotFoundError, InvalidConversationIdError } from "../conversation/conversation.utils";
import type { ChatService } from "./chat.service";

export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    sendMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
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
        }
    };
}
