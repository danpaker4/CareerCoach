import type { FastifyReply } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import { getAccessTokenGitSchema } from "./github.schema";

export type GithubHandlerType = {
    getAccessTokenGit: (request: SchematicRequest<typeof getAccessTokenGitSchema>, reply: FastifyReply) => Promise<void>;
    getUserData: (request: SchematicRequest<typeof getAccessTokenGitSchema>, reply: FastifyReply) => Promise<void>;
};
