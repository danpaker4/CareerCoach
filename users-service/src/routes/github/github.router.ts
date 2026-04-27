import type { Collection } from "mongodb";
import { TypedFastify } from "../../types/fastify";
import { GithubHandler } from "./github.handler";
import type { User } from "../users/user.model";
import { githubCallbackSchema } from "./github.schema";

type registerRouter = (fastify: TypedFastify) => void;

export const githubRouter = (usersCollection: Collection<User>): registerRouter => (fastify: TypedFastify): void => {
    const handler = GithubHandler(usersCollection);

    fastify.get("/github/callback", { schema: githubCallbackSchema }, handler.githubCallback);
};
