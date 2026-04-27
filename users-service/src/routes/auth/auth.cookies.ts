import type { FastifyReply } from "fastify";
import type { AuthTokens } from "./auth.types";
import {
  getRefreshTokenCookie,
  getRefreshTokenExpiresInSeconds,
} from "./auth.utils";

const cookieBaseOptions = () => ({
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

export const setRefreshTokenCookie = (reply: FastifyReply, refreshToken: string): void => {
  reply.setCookie(getRefreshTokenCookie(), refreshToken, {
    ...cookieBaseOptions(),
    maxAge: getRefreshTokenExpiresInSeconds(),
  });
};

export const setAuthCookies = (reply: FastifyReply, tokens: AuthTokens): void => {
  setRefreshTokenCookie(reply, tokens.refreshToken);
};

export const clearAuthCookies = (reply: FastifyReply): void => {
  reply.clearCookie(getRefreshTokenCookie(), { path: "/" });
};
