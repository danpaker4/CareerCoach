import type { FastifyReply, FastifyRequest } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import { githubCallbackSchema, githubLinkSchema } from "./github.schema";
import type { User } from "../users/user.model";

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

export type GithubLinkResult =
  | {
      status: "updated";
      user: User;
    }
  | {
      status: "not_found";
    }
  | {
      status: "github_in_use";
    };

export type GithubHandlerType = {
    githubCallback: (request: SchematicRequest<typeof githubCallbackSchema>, reply: FastifyReply) => Promise<void>;
    githubLink: (
        request: SchematicRequest<typeof githubLinkSchema> & Pick<FastifyRequest, "authUser">,
        reply: FastifyReply,
    ) => Promise<void>;
};
