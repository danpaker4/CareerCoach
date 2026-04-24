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
