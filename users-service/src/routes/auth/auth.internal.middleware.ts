import type { FastifyReply, FastifyRequest } from "fastify";
import { authenticateRequest } from "./auth.middleware";
import {
    getInternalServiceApiKey,
    readInternalServiceApiKeyHeader,
    readInternalServiceUserId,
} from "./auth.internal.utils";

type RouteWithUserIdParams = {
    userId?: string;
};

export const authenticateUserOrInternalService = async (
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> => {
    const configuredInternalKey = getInternalServiceApiKey();
    const routeUserId = (request.params as RouteWithUserIdParams).userId;
    const headerUserId = readInternalServiceUserId(request.headers);
    const headerInternalKey = readInternalServiceApiKeyHeader(request.headers);

    if (
        configuredInternalKey !== undefined &&
        routeUserId !== undefined &&
        headerUserId === routeUserId &&
        headerInternalKey === configuredInternalKey
    ) {
        request.authUser = {
            userId: routeUserId,
            email: "service@internal",
        };
        return;
    }

    await authenticateRequest(request, reply);
};
