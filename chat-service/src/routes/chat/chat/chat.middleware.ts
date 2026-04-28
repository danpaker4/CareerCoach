import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { hasUserIdParam, isChatMessageBody } from "./chat.utils";

export const validateUserIdParam = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!hasUserIdParam(request.params)) {
        reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId is required in route params" });
    }
};

export const validateChatMessageBody = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!isChatMessageBody(request.body)) {
        reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId and message are required" });
    }
};
