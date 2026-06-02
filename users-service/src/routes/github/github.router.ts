import type { Collection } from "mongodb";
import { TypedFastify } from "../../types/fastify";
import { GithubHandler } from "./github.handler";
import type { UserDocument } from "../users/user.model";
import { githubCallbackSchema, githubLinkSchema } from "./github.schema";
import { authenticateRequest } from "../auth/auth.middleware";

type registerRouter = (fastify: TypedFastify) => void;

export const githubRouter = (usersCollection: Collection<UserDocument>): registerRouter => (fastify: TypedFastify): void => {
    const handler = GithubHandler(usersCollection);

    fastify.get("/github/callback", { schema: githubCallbackSchema }, handler.githubCallback);
    fastify.get("/github/link", { schema: githubLinkSchema, preHandler: authenticateRequest }, handler.githubLink);
};
