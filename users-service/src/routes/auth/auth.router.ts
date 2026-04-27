import type { FastifyInstance } from "fastify";
import type { Collection } from "mongodb";
import { AUTH_ROUTE_PATHS } from "./auth.consts";
import { getAuthenticatedUser, loginUser, logoutUser, refreshAccessToken, registerUser } from "./auth.handler";
import type { User } from "../users/user.model";

export const authRouter = (usersCollection: Collection<User>) => async (app: FastifyInstance) => {
  app.post(AUTH_ROUTE_PATHS.register, registerUser(usersCollection));
  app.post(AUTH_ROUTE_PATHS.login, loginUser(usersCollection));
  app.get(AUTH_ROUTE_PATHS.me, getAuthenticatedUser(usersCollection));
  app.get(AUTH_ROUTE_PATHS.refresh, refreshAccessToken(usersCollection));
  app.post(AUTH_ROUTE_PATHS.logout, logoutUser());
};
