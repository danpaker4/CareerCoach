import type { FastifyReply, FastifyRequest } from "fastify";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { verifyToken } from "./auth-tokens.service";
import { ACCESS_TOKEN_COOKIE } from "./auth.utils";

export const authenticateRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const accessToken = request.cookies[ACCESS_TOKEN_COOKIE];
  if (!accessToken) {
    reply.status(401).send({ error: "Access token missing", errorCode: "ACCESS_TOKEN_MISSING" });
    return;
  }

  try {
    const payload = verifyToken(accessToken);
    request.authUser = payload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      reply.status(401).send({ error: "Access token expired", errorCode: "ACCESS_TOKEN_EXPIRED" });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      reply.status(401).send({ error: "Invalid access token", errorCode: "ACCESS_TOKEN_INVALID" });
      return;
    }
    reply.status(401).send({ error: "Unauthorized", errorCode: "UNAUTHORIZED" });
  }
};
