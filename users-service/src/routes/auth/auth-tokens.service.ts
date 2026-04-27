import jwt from "jsonwebtoken";
import type { AuthTokenPayload, AuthTokenSubject } from "./auth.types";
import {
  getAccessTokenExpiresInSeconds,
  isAuthTokenPayload,
  getRefreshTokenExpiresInSeconds,
  getAccessJwtSecret,
  getRefreshJwtSecret,
} from "./auth.utils";

export const generateAccessToken = (payload: AuthTokenSubject): string =>
  jwt.sign({ ...payload, tokenType: "access" }, getAccessJwtSecret(), {
    expiresIn: getAccessTokenExpiresInSeconds(),
  });

export const generateRefreshToken = (payload: AuthTokenSubject): string =>
  jwt.sign({ ...payload, tokenType: "refresh" }, getRefreshJwtSecret(), {
    expiresIn: getRefreshTokenExpiresInSeconds(),
  });

const verifyTypedToken = (token: string, tokenType: AuthTokenPayload["tokenType"], secret: string): AuthTokenPayload => {
  const payload = jwt.verify(token, secret);
  if (!isAuthTokenPayload(payload)) {
    throw new Error("Invalid token payload");
  }

  if (payload.tokenType !== tokenType) {
    throw new Error(`Invalid ${tokenType} token`);
  }

  return payload;
};

export const verifyAccessToken = (token: string): AuthTokenPayload =>
  verifyTypedToken(token, "access", getAccessJwtSecret());

export const verifyRefreshToken = (token: string): AuthTokenPayload =>
  verifyTypedToken(token, "refresh", getRefreshJwtSecret());
