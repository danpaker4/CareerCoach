import type { FastifyInstance } from "fastify";
import type { Collection } from "mongodb";
import type { UserDocument } from "../users/user.model";
import { AUTH_ROUTE_PATHS } from "./auth.consts";
import { getAuthSession, loginUser, logoutUser, refreshAccessToken, registerUser } from "./auth.handler";
import { authenticateRequest } from "./auth.middleware";

export const authRouter = (usersCollection: Collection<UserDocument>) => async (app: FastifyInstance) => {
  app.post(AUTH_ROUTE_PATHS.register, registerUser(usersCollection));
  app.post(AUTH_ROUTE_PATHS.login, loginUser(usersCollection));
  app.get(AUTH_ROUTE_PATHS.refresh, refreshAccessToken(usersCollection));
  app.get(AUTH_ROUTE_PATHS.session, { preHandler: authenticateRequest }, getAuthSession());
  app.post(AUTH_ROUTE_PATHS.logout, logoutUser());
};
