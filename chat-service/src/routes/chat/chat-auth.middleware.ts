import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ChatAuthFailure, ChatAuthService } from "./chat-auth.service";

const INTERNAL_SERVICE_EMAIL = "internal@careercoach.local";

const readAuthorizationHeader = (request: FastifyRequest): string | undefined => {
    const header = request.headers.authorization;
    return typeof header === "string" ? header : undefined;
};

const readInternalServiceKey = (request: FastifyRequest): string | undefined => {
    const header = request.headers["x-internal-service-key"];
    return typeof header === "string" ? header : undefined;
};

const isInternalServiceRequest = (request: FastifyRequest, internalServiceApiKey?: string): boolean =>
    internalServiceApiKey !== undefined &&
    internalServiceApiKey.length > 0 &&
    readInternalServiceKey(request) === internalServiceApiKey;

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

const readQueryUserId = (request: FastifyRequest): string | null => {
    const query = request.query;
    if (typeof query !== "object" || query === null || !("userId" in query)) {
        return null;
    }

    const userId = (query as { userId?: unknown }).userId;
    return typeof userId === "string" ? userId : null;
};

export const createValidateAuthenticatedChatBody = (authService: ChatAuthService, internalServiceApiKey?: string) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (isInternalServiceRequest(request, internalServiceApiKey)) {
            const internalUserId = readBodyUserId(request);
            if (!internalUserId) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId is required", errorCode: "USER_ID_REQUIRED" });
                return;
            }

            request.authUser = { userId: internalUserId, email: INTERNAL_SERVICE_EMAIL };
            return;
        }

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

export const createValidateAuthenticatedChatSession = (authService: ChatAuthService, internalServiceApiKey?: string) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (isInternalServiceRequest(request, internalServiceApiKey)) {
            const internalUserId = readQueryUserId(request);
            if (!internalUserId) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId is required", errorCode: "USER_ID_REQUIRED" });
                return;
            }

            request.authUser = { userId: internalUserId, email: INTERNAL_SERVICE_EMAIL };
            return;
        }

        const authResult = await authService.verifyUser(readAuthorizationHeader(request));
        if (authResult.status === "failure") {
            sendAuthFailure(reply, authResult.failure);
            return;
        }

        request.authUser = authResult.user;
    };

export const createValidateAuthenticatedChatParams = (authService: ChatAuthService, internalServiceApiKey?: string) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (isInternalServiceRequest(request, internalServiceApiKey)) {
            const internalUserId = readParamsUserId(request);
            if (!internalUserId) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId is required", errorCode: "USER_ID_REQUIRED" });
                return;
            }

            request.authUser = { userId: internalUserId, email: INTERNAL_SERVICE_EMAIL };
            return;
        }

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
