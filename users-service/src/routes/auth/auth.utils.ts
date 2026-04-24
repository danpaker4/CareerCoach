import type { RegisterMultipartData, MultipartIteratorPart, AuthTokenPayload, LoginBody } from "./auth.types";
import type { User } from "../users/user.model";

export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";

export const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 60;
export const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }
  return secret;
};

export const isLoginBody = (body: unknown): body is LoginBody => {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  return (
    "email" in body &&
    "password" in body &&
    typeof body.email === "string" &&
    typeof body.password === "string"
  );
};

export const isAuthTokenPayload = (payload: unknown): payload is AuthTokenPayload => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  return (
    "userId" in payload &&
    "email" in payload &&
    typeof payload.userId === "string" &&
    typeof payload.email === "string"
  );
};

export const appendPart = (
  current: RegisterMultipartData,
  part: MultipartIteratorPart,
): RegisterMultipartData => {
  if (part?.type === "file" && part.fieldname === "cv") {
    return { ...current, cvFile: part };
  }
  if (part?.type === "field") {
    return {
      ...current,
      fields: {
        ...current.fields,
        [part.fieldname]: String(part.value ?? ""),
      },
    };
  }
  return current;
};

export const readMultipartData = async (
  iterator: AsyncIterator<MultipartIteratorPart>,
  acc: RegisterMultipartData = { fields: {}, cvFile: null },
): Promise<RegisterMultipartData> => {
  const next = await iterator.next();
  if (next.done) {
    return acc;
  }
  return readMultipartData(iterator, appendPart(acc, next.value));
};

export const toSafeUser = (user: User): Omit<User, "password"> => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};