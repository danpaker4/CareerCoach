import { MultipartFile } from "@fastify/multipart";
import { RegisterMultipartData } from "./auth.types";
import { User } from "../users/user.model";

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

export const appendPart = (
  current: import("./auth.types").RegisterMultipartData,
  part: import("./auth.types").MultipartIteratorPart,
): import("./auth.types").RegisterMultipartData => {
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
  iterator: AsyncIterator<any>,
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