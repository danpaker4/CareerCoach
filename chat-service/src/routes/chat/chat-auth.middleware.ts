import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ChatAuthFailure, ChatAuthService } from "./chat-auth.service";

const readAuthorizationHeader = (request: FastifyRequest): string | undefined => {
    const header = request.headers.authorization;
    return typeof header === "string" ? header : undefined;
};

const sendAuthFailure = (reply: FastifyReply, failure: ChatAuthFailure): void => {
    reply.status(failure.statusCode).send({
        error: failure.error,
        ...(failure.errorCode ? { errorCode: failure.errorCode } : {}),
    });
};

const readBodyUserId = (request: FastifyRequest): string | null => {
    const body = request.body;
    if (typeof body !== "object" || body === null || !("userId" in body)) {
        return null;
    }

    const userId = (body as { userId?: unknown }).userId;
    return typeof userId === "string" ? userId : null;
};

const readParamsUserId = (request: FastifyRequest): string | null => {
    const params = request.params;
    if (typeof params !== "object" || params === null || !("userId" in params)) {
        return null;
    }

    const userId = (params as { userId?: unknown }).userId;
    return typeof userId === "string" ? userId : null;
};

export const createValidateAuthenticatedChatBody = (authService: ChatAuthService) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await authService.verifyUser(readAuthorizationHeader(request));
        if (authResult.status === "failure") {
            sendAuthFailure(reply, authResult.failure);
            return;
        }

        const userId = readBodyUserId(request);
        if (!userId || userId !== authResult.user.userId) {
            reply.status(StatusCodes.FORBIDDEN).send({
                error: "Authenticated user does not match request user",
                errorCode: "USER_MISMATCH",
            });
            return;
        }

        request.authUser = authResult.user;
    };

export const createValidateAuthenticatedChatSession = (authService: ChatAuthService) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await authService.verifyUser(readAuthorizationHeader(request));
        if (authResult.status === "failure") {
            sendAuthFailure(reply, authResult.failure);
            return;
        }

        request.authUser = authResult.user;
    };

export const createValidateAuthenticatedChatParams = (authService: ChatAuthService) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await authService.verifyUser(readAuthorizationHeader(request));
        if (authResult.status === "failure") {
            sendAuthFailure(reply, authResult.failure);
            return;
        }

        const userId = readParamsUserId(request);
        if (!userId || userId !== authResult.user.userId) {
            reply.status(StatusCodes.FORBIDDEN).send({
                error: "Authenticated user does not match request user",
                errorCode: "USER_MISMATCH",
            });
            return;
        }

        request.authUser = authResult.user;
    };
