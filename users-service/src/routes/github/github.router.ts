import type { Collection } from "mongodb";
import { TypedFastify } from "../../types/fastify";
import { GithubHandler } from "./github.handler";
import type { UserDocument } from "../users/user.model";
import { githubCallbackSchema } from "./github.schema";

type registerRouter = (fastify: TypedFastify) => void;

export const githubRouter = (usersCollection: Collection<UserDocument>): registerRouter => (fastify: TypedFastify): void => {
    const handler = GithubHandler(usersCollection);

    fastify.get("/github/callback", { schema: githubCallbackSchema }, handler.githubCallback);
};
