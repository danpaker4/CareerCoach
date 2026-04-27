import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Collection } from "mongodb";
import type { User } from "../users/user.model";
import { clearAuthCookies, setAuthCookies } from "./auth.cookies";
import {
  loginUserSession,
  refreshUserAccessToken,
  registerUserSession,
} from "./auth.service";
import type { AuthRouteHandler } from "./auth.types";
import {
  getRefreshTokenCookie,
  isAuthRouteError,
  isLoginBody,
  readMultipartData,
  sendAuthError,
  sendKnownTokenError,
} from "./auth.utils";

export const registerUser = (usersCollection: Collection<User>): AuthRouteHandler =>
  async (request, reply) => {
    try {
      if (!request.isMultipart()) {
        reply.status(StatusCodes.BAD_REQUEST).send({ error: "Registration must use multipart/form-data" });
        return;
      }

      const parts = request.parts();
      const { fields, cvFile } = await readMultipartData(parts[Symbol.asyncIterator]());
      const session = await registerUserSession(usersCollection, {
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        password: fields.password,
        birthDate: fields.birthDate,
        currentJob: fields.currentJob,
        linkedInUrl: fields.linkedInUrl,
        githubUrl: fields.githubUrl,
        cvFile,
      });

      setAuthCookies(reply, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
      reply.send({
        success: true,
        userId: session.user.id,
        user: session.user,
        accessToken: session.accessToken,
      });
    } catch (error) {
      sendAuthError(reply, error);
    }
  };

export const loginUser = (usersCollection: Collection<User>): AuthRouteHandler =>
  async (request, reply) => {
    try {
      if (!isLoginBody(request.body)) {
        reply.status(StatusCodes.BAD_REQUEST).send({ error: "Email and password are required" });
        return;
      }

      const session = await loginUserSession(usersCollection, request.body);
      setAuthCookies(reply, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
      reply.send({
        success: true,
        user: session.user,
        accessToken: session.accessToken,
      });
    } catch (error) {
      sendAuthError(reply, error);
    }
  };

export const refreshAccessToken = (usersCollection: Collection<User>): AuthRouteHandler =>
  async (request, reply) => {
    const refreshToken = request.cookies[getRefreshTokenCookie()];
    if (!refreshToken) {
      clearAuthCookies(reply);
      reply.status(StatusCodes.UNAUTHORIZED).send({
        error: "Refresh token missing",
        errorCode: "REFRESH_TOKEN_MISSING",
      });
      return;
    }

    try {
      const session = await refreshUserAccessToken(usersCollection, refreshToken);
      reply.send({
        success: true,
        accessToken: session.accessToken,
        user: session.user,
      });
    } catch (error) {
      clearAuthCookies(reply);
      if (isAuthRouteError(error)) {
        reply.status(StatusCodes.UNAUTHORIZED).send({
          error: "Invalid refresh token",
          errorCode: "REFRESH_TOKEN_INVALID",
        });
        return;
      }

      sendKnownTokenError(reply, error, {
        expired: { error: "Refresh token expired", errorCode: "REFRESH_TOKEN_INVALID" },
        invalid: { error: "Invalid refresh token", errorCode: "REFRESH_TOKEN_INVALID" },
        unknown: { error: "Refresh token invalid or expired", errorCode: "REFRESH_TOKEN_INVALID" },
      });
    }
  };

export const logoutUser = (): AuthRouteHandler =>
  async (_request, reply) => {
    clearAuthCookies(reply);
    reply.send({ success: true });
  };
