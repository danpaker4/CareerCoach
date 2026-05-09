import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ChatMessageRequestBody } from "../chat.types";
import { ChatService } from "./chat.service";

export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    getConversation = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId } = request.params as { userId: string };
            const conversation = await this.chatService.getConversation(userId);
            reply.status(StatusCodes.OK).send(conversation);
        } catch (error) {
            request.log.error({ error }, "Failed loading conversation");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed loading conversation",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    sendMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const body = request.body as ChatMessageRequestBody;
            const response = await this.chatService.sendMessage(body.userId, body.message, body.userProfile);
            reply.status(StatusCodes.OK).send(response);
        } catch (error) {
            if (error instanceof Error && error.message === "Message is required") {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: error.message });
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
