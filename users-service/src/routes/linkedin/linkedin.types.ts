import type { FastifyReply } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import { linkedInCallbackSchema } from "./linkedin.schema";

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface LinkedInUserProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  email_verified: boolean;
  picture?: string;
}

export type LinkedInHandlerType = {
  linkedInCallback: (request: SchematicRequest<typeof linkedInCallbackSchema>, reply: FastifyReply) => Promise<void>;
};
