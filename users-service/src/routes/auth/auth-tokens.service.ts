import type { FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload, AuthTokens } from "./auth.types";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  getJwtSecret,
  isAuthTokenPayload,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_EXPIRES_IN_SECONDS,
} from "./auth.utils";

export const generateAccessToken = (payload: AuthTokenPayload): string =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS });

export const generateRefreshToken = (payload: AuthTokenPayload): string =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: REFRESH_TOKEN_EXPIRES_IN_SECONDS });

export const verifyToken = (token: string): AuthTokenPayload => {
  const payload = jwt.verify(token, getJwtSecret());
  if (!isAuthTokenPayload(payload)) {
    throw new Error("Invalid token payload");
  }
  return payload;
};

const cookieBaseOptions = () => ({
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

export const setAccessTokenCookie = (reply: FastifyReply, accessToken: string): void => {
  reply.setCookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieBaseOptions(),
    maxAge: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  });
};

export const setRefreshTokenCookie = (reply: FastifyReply, refreshToken: string): void => {
  reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieBaseOptions(),
    maxAge: REFRESH_TOKEN_EXPIRES_IN_SECONDS,
  });
};

export const setAuthCookies = (
  reply: FastifyReply,
  tokens: AuthTokens,
): void => {
  setAccessTokenCookie(reply, tokens.accessToken);
  setRefreshTokenCookie(reply, tokens.refreshToken);
};

export const clearAuthCookies = (reply: FastifyReply): void => {
  reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
  reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
};
