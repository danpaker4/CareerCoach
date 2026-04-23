import { TypedFastify } from "../../types/fastify";
import { GithubHandler } from "./github.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const githubRouter = (): registerRouter => (fastify: TypedFastify): void => {
    const handler = GithubHandler();

    fastify.get("/accessTokenGit", handler.getAccessTokenGit);
    fastify.get("/userData", handler.getAccessTokenGit);
};
