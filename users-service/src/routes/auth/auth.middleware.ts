import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { verifyAccessToken } from "./auth-tokens.service";
import { getBearerToken } from "./auth.utils";
import { isChatInternalKeyValid, readUserIdFromRouteParams } from "./chat-internal-auth.utils";

export const authenticateRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const rawInternal = request.headers["x-career-coach-internal-key"];
    const internalHeader = Array.isArray(rawInternal) ? rawInternal[0] : rawInternal;
    if (isChatInternalKeyValid(typeof internalHeader === "string" ? internalHeader : undefined)) {
        const userId = readUserIdFromRouteParams(request);
        if (!userId) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId is required in route params" });
            return;
        }
        request.authUser = { userId, email: "chat-service@internal" };
        return;
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
        reply.status(StatusCodes.UNAUTHORIZED).send({ error: "Access token missing", errorCode: "ACCESS_TOKEN_MISSING" });
        return;
    }

    try {
        const payload = verifyAccessToken(accessToken);
        request.authUser = payload;
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            reply.status(StatusCodes.UNAUTHORIZED).send({ error: "Access token expired", errorCode: "ACCESS_TOKEN_EXPIRED" });
            return;
        }
        if (error instanceof jwt.JsonWebTokenError) {
            reply.status(StatusCodes.UNAUTHORIZED).send({ error: "Invalid access token", errorCode: "ACCESS_TOKEN_INVALID" });
            return;
        }
        reply.status(StatusCodes.UNAUTHORIZED).send({ error: "Unauthorized", errorCode: "UNAUTHORIZED" });
    }
};
