import type { FastifyReply } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import { githubCallbackSchema } from "./github.schema";

export type GithubTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
};

export type GithubTokenErrorResponse = {
  error?: string;
  error_description?: string;
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

export type GithubRepository = {
  name: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  language: string | null;
  languages_url: string;
  topics: string[];
  stargazers_count: number;
  pushed_at: string;
  owner: {
    login: string;
  };
};

export type GithubRepositoryLanguages = Record<string, number>;

export type GithubContentFileResponse = {
  content?: string;
  encoding?: string;
  type?: string;
};

export type GithubContentListItem = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
};

export type GithubTreeEntry = {
  path: string;
  type: "blob" | "tree" | "commit";
};

export type GithubTreeResponse = {
  tree?: GithubTreeEntry[];
  truncated?: boolean;
};

export type GithubHandlerType = {
    githubCallback: (request: SchematicRequest<typeof githubCallbackSchema>, reply: FastifyReply) => Promise<void>;
};
