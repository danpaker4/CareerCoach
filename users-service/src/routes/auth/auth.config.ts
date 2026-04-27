import "dotenv/config";
import { z } from "zod";
import type { AuthConfig } from "./auth.types";

const AuthEnvSchema = z.object({
  REFRESH_TOKEN_COOKIE: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN_SECONDS: z.coerce.number().int().positive(),
  JWT_REFRESH_EXPIRES_IN_SECONDS: z.coerce.number().int().positive(),
});

const createAuthConfig = (env: z.infer<typeof AuthEnvSchema>): AuthConfig => ({
  refreshTokenCookie: env.REFRESH_TOKEN_COOKIE,
  accessJwtSecret: env.JWT_ACCESS_SECRET,
  refreshJwtSecret: env.JWT_REFRESH_SECRET,
  accessTokenExpiresInSeconds: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
  refreshTokenExpiresInSeconds: env.JWT_REFRESH_EXPIRES_IN_SECONDS,
});

export const getAuthConfig = (): AuthConfig => createAuthConfig(AuthEnvSchema.parse(process.env));
