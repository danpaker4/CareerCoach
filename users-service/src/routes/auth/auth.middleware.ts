import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { verifyAccessToken } from "./auth-tokens.service";
import { getAccessTokenCookie, getBearerToken } from "./auth.utils";

export const authenticateRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const accessToken = getBearerToken(request) ?? request.cookies[getAccessTokenCookie()];
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
