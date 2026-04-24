import type { MultipartFile } from "@fastify/multipart";

export type AuthTokenPayload = {
  userId: string;
  email: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type RegisterFields = Record<string, string>;

export type RegisterMultipartData = {
  fields: RegisterFields;
  cvFile: MultipartFile | null;
};

export type MultipartIteratorPart = Awaited<ReturnType<AsyncIterator<any>["next"]>>["value"];

export type LoginBody = {
  email: string;
  password: string;
};
