import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import type { Collection } from "mongodb";
import { registerUser } from "../users/register/register-user.service";
import type { RegisterUserInput } from "../users/register/register-user.types";
import type { User } from "../users/user.model";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "./auth-tokens.service";
import { AuthRouteError } from "./auth.types";
import type { AuthTokenSubject, AuthenticatedUser, AuthenticatedUserSession, LoginBody, SafeUser } from "./auth.types";
import { toSafeUser } from "./auth.utils";

const buildTokenSubject = (user: Pick<User, "id" | "email">): AuthTokenSubject => ({
  userId: user.id,
  email: user.email,
});

const buildAuthenticatedUser = (user: SafeUser): AuthenticatedUser => {
  const tokenSubject = buildTokenSubject(user);
  const accessToken = generateAccessToken(tokenSubject);
  const refreshToken = generateRefreshToken(tokenSubject);

  return {
    ...user,
    accessToken,
    refreshToken,
  };
};

const buildAuthenticatedSession = (user: SafeUser): AuthenticatedUserSession => {
  const authenticatedUser = buildAuthenticatedUser(user);

  return {
    accessToken: authenticatedUser.accessToken,
    refreshToken: authenticatedUser.refreshToken,
    user: authenticatedUser,
  };
};

const findUserById = async (usersCollection: Collection<User>, userId: string): Promise<User> => {
  const user = await usersCollection.findOne({ id: userId });
  if (!user) {
    throw new AuthRouteError(StatusCodes.UNAUTHORIZED, "User not found", "ACCESS_TOKEN_INVALID");
  }

  return user;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const registerUserSession = async (
  usersCollection: Collection<User>,
  input: RegisterUserInput,
): Promise<AuthenticatedUserSession> => {
  try {
    const user = await registerUser(usersCollection, input);
    return buildAuthenticatedSession(user);
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes("exists") || error.message.includes("Missing") || error.message.includes("must") || error.message.includes("required")
        ? StatusCodes.BAD_REQUEST
        : StatusCodes.INTERNAL_SERVER_ERROR;
      throw new AuthRouteError(statusCode, error.message);
    }

    throw error;
  }
};

export const loginUserSession = async (
  usersCollection: Collection<User>,
  credentials: LoginBody,
): Promise<AuthenticatedUserSession> => {
  const authenticatedUser = await usersCollection.findOne({ email: normalizeEmail(credentials.email) });
  if (authenticatedUser === null) {
    throw new AuthRouteError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(credentials.password, authenticatedUser.password);
  if (!passwordMatches) {
    throw new AuthRouteError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
  }

  return buildAuthenticatedSession(toSafeUser(authenticatedUser));
};

export const refreshUserAccessToken = async (
  usersCollection: Collection<User>,
  refreshToken: string,
): Promise<{ accessToken: string; user: SafeUser }> => {
  const payload = verifyRefreshToken(refreshToken);
  const user = await findUserById(usersCollection, payload.userId);
  const safeUser = toSafeUser(user);

  return {
    accessToken: generateAccessToken(buildTokenSubject(safeUser)),
    user: safeUser,
  };
};
