import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import type {
  AuthRouteError,
  RegisterMultipartData,
  MultipartIteratorPart,
  AuthTokenPayload,
  LoginBody,
  TokenErrorResponses,
} from "./auth.types";
import type { User } from "../users/user.model";
import { getAuthConfig } from "./auth.config";

export const isLoginBody = (body: unknown): body is LoginBody => {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  return (
    "email" in body &&
    "password" in body &&
    typeof body.email === "string" &&
    typeof body.password === "string"
  );
};

export const isAuthTokenPayload = (payload: unknown): payload is AuthTokenPayload => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  return (
    "userId" in payload &&
    "email" in payload &&
    "tokenType" in payload &&
    typeof payload.userId === "string" &&
    typeof payload.email === "string" &&
    (payload.tokenType === "access" || payload.tokenType === "refresh")
  );
};

export const isAuthRouteError = (error: unknown): error is AuthRouteError =>
  typeof error === "object" &&
  error !== null &&
  "statusCode" in error &&
  typeof error.statusCode === "number" &&
  "message" in error &&
  typeof error.message === "string";

export const getBearerToken = (request: FastifyRequest): string | null => {
  const authorizationHeader = request.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
};

export const getRefreshTokenCookie = (): string => getAuthConfig().refreshTokenCookie;

export const getAccessTokenExpiresInSeconds = (): number => getAuthConfig().accessTokenExpiresInSeconds;

export const getRefreshTokenExpiresInSeconds = (): number => getAuthConfig().refreshTokenExpiresInSeconds;

export const getAccessJwtSecret = (): string => getAuthConfig().accessJwtSecret;

export const getRefreshJwtSecret = (): string => getAuthConfig().refreshJwtSecret;

export const sendKnownTokenError = (
  reply: FastifyReply,
  error: unknown,
  errors: TokenErrorResponses,
): void => {
  if (error instanceof TokenExpiredError) {
    reply.status(StatusCodes.UNAUTHORIZED).send(errors.expired);
    return;
  }

  if (error instanceof jwt.JsonWebTokenError) {
    reply.status(StatusCodes.UNAUTHORIZED).send(errors.invalid);
    return;
  }

  reply.status(StatusCodes.UNAUTHORIZED).send(errors.unknown);
};

export const sendAuthError = (reply: FastifyReply, error: unknown): void => {
  if (isAuthRouteError(error)) {
    reply.status(error.statusCode).send({
      error: error.message,
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
    });
    return;
  }

  if (error instanceof Error) {
    reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: error.message });
    return;
  }

  reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Internal Server Error" });
};

export const appendPart = (
  current: RegisterMultipartData,
  part: MultipartIteratorPart,
): RegisterMultipartData => {
  if (part?.type === "file" && part.fieldname === "cv") {
    return { ...current, cvFile: part };
  }
  if (part?.type === "field") {
    return {
      ...current,
      fields: {
        ...current.fields,
        [part.fieldname]: String(part.value ?? ""),
      },
    };
  }
  return current;
};

export const readMultipartData = async (
  iterator: AsyncIterator<MultipartIteratorPart>,
  acc: RegisterMultipartData = { fields: {}, cvFile: null },
): Promise<RegisterMultipartData> => {
  const next = await iterator.next();
  if (next.done) {
    return acc;
  }
  return readMultipartData(iterator, appendPart(acc, next.value));
};

export const toSafeUser = (user: User): Omit<User, "password"> => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};
