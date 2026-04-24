import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { ChatService } from "./chat.service";
import type { ChatMessageRequestBody } from "./chat.types";

const isChatMessageBody = (body: unknown): body is ChatMessageRequestBody => {
    if (typeof body !== "object" || body === null) {
        return false;
    }

    return (
        "userId" in body &&
        "message" in body &&
        typeof body.userId === "string" &&
        typeof body.message === "string" &&
        (!("userProfile" in body) || typeof body.userProfile === "object" || body.userProfile === undefined || body.userProfile === null)
    );
};

const hasUserIdParam = (params: unknown): params is { userId: string } =>
    typeof params === "object" && params !== null && "userId" in params && typeof (params as { userId: unknown }).userId === "string";

export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    getConversation = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (!hasUserIdParam(request.params)) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId is required in route params" });
            return;
        }

        try {
            const conversation = await this.chatService.getConversation(request.params.userId);
            reply.status(StatusCodes.OK).send(conversation);
        } catch (error) {
            request.log.error({ error }, "Failed loading conversation");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Failed loading conversation" });
        }
    };

    sendMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (!isChatMessageBody(request.body)) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId and message are required" });
            return;
        }

        try {
            const response = await this.chatService.sendMessage(request.body.userId, request.body.message, request.body.userProfile);
            reply.status(StatusCodes.OK).send(response);
        } catch (error) {
            if (error instanceof Error && error.message === "Message is required") {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: error.message });
                return;
            }

            request.log.error({ error }, "Failed sending chat message");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Failed sending chat message" });
        }
    };
}
