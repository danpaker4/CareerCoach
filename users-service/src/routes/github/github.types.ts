import type { FastifyReply } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import { githubCallbackSchema } from "./github.schema";

export type GithubTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
};

export type GithubUserProfile = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
  company: string | null;
};

export type GithubUserEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
};

export type GithubHandlerType = {
    githubCallback: (request: SchematicRequest<typeof githubCallbackSchema>, reply: FastifyReply) => Promise<void>;
};
