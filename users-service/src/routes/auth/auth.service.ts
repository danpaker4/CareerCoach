import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import type { Collection } from "mongodb";
import { registerUser } from "../users/register/register-user.service";
import type { RegisterUserInput } from "../users/register/register-user.types";
import type { User, UserDocument } from "../users/user.model";
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

export const buildAuthenticatedSession = (user: SafeUser): AuthenticatedUserSession => {
  const authenticatedUser = buildAuthenticatedUser(user);

  return {
    accessToken: authenticatedUser.accessToken,
    refreshToken: authenticatedUser.refreshToken,
    user: authenticatedUser,
  };
};

const findUserById = async (usersCollection: Collection<UserDocument>, userId: string): Promise<UserDocument> => {
  const user = await usersCollection.findOne({ _id: userId });
  if (!user) {
    throw new AuthRouteError(StatusCodes.UNAUTHORIZED, "User not found", "ACCESS_TOKEN_INVALID");
  }

  return user;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const registerUserSession = async (
  usersCollection: Collection<UserDocument>,
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
  usersCollection: Collection<UserDocument>,
  credentials: LoginBody,
): Promise<AuthenticatedUserSession> => {
  const authenticatedUser = await usersCollection.findOne({ email: normalizeEmail(credentials.email) });
  if (authenticatedUser === null) {
    throw new AuthRouteError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
  }

  if (!authenticatedUser.password) {
    throw new AuthRouteError(StatusCodes.UNAUTHORIZED, "Please log in using GitHub.");
  }

  const passwordMatches = await bcrypt.compare(credentials.password, authenticatedUser.password);
  if (!passwordMatches) {
    throw new AuthRouteError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
  }

  return buildAuthenticatedSession(toSafeUser(authenticatedUser));
};

export const refreshUserAccessToken = async (
  usersCollection: Collection<UserDocument>,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> => {
  const payload = verifyRefreshToken(refreshToken);
  const user = await findUserById(usersCollection, payload.userId);
  const safeUser = toSafeUser(user);
  const tokenSubject = buildTokenSubject(safeUser);

  return {
    accessToken: generateAccessToken(tokenSubject),
    refreshToken: generateRefreshToken(tokenSubject),
    user: safeUser,
  };
};
