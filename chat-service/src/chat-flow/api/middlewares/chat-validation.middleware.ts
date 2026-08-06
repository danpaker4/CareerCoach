import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { hasUserIdParam, hasUserIdAndConversationIdParams, isChatMessageBody } from "../shared/chat.utils";

export const validateUserIdParam = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!hasUserIdParam(request.params)) {
        await reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId is required in route params" });
        return;
    }
};

export const validateUserIdAndConversationIdParams = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!hasUserIdAndConversationIdParams(request.params)) {
        await reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId and conversationId are required in route params" });
        return;
    }
};

export const validateChatMessageBody = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!isChatMessageBody(request.body)) {
        await reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId and message are required" });
        return;
    }
};
