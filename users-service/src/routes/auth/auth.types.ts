import type { FastifyReply, FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import type { User } from "../users/user.model";

export type AuthTokenSubject = {
  userId: string;
  email: string;
};

export type AuthTokenPayload = AuthTokenSubject & {
  tokenType: "access" | "refresh";
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthenticatedUser = SafeUser & AuthTokens;

export type AuthenticatedUserSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
};

export type RegisterFields = Record<string, string>;

export type RegisterMultipartData = {
  fields: RegisterFields;
  cvFile: MultipartFile | null;
};

export type MultipartField = {
  type: "field";
  fieldname: string;
  value: unknown;
};

export type MultipartIteratorPart = MultipartFile | MultipartField;

export type LoginBody = {
  email: string;
  password: string;
};

export type SafeUser = Omit<User, "password">;

export type AuthRouteHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export type TokenErrorResponse = {
  error: string;
  errorCode: string;
};

export type TokenErrorResponses = {
  expired: TokenErrorResponse;
  invalid: TokenErrorResponse;
  unknown: TokenErrorResponse;
};

export type AuthConfig = {
  refreshTokenCookie: string;
  accessJwtSecret: string;
  refreshJwtSecret: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
};

export class AuthRouteError extends Error {
  readonly statusCode: number;
  readonly errorCode?: string;

  constructor(statusCode: number, message: string, errorCode?: string) {
    super(message);
    this.name = "AuthRouteError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
