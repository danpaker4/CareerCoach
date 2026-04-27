import { FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import { SchematicRequest } from "../../types/fastify";
import { getAccessTokenGitSchema } from "./github.schema";
import type { GithubHandlerType } from "./github.types";
import { serializeRouteError } from "./github.utils";

export const GithubHandler = (): GithubHandlerType => {
    return {
        getAccessTokenGit: async (request: SchematicRequest<typeof getAccessTokenGitSchema>, reply: FastifyReply) => {
            try {
                reply.code(StatusCodes.OK).send("OK");
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send(serializeRouteError(error));
            }
        },

        getUserData: async (request: SchematicRequest<typeof getAccessTokenGitSchema>, reply: FastifyReply) => {
            const { authorization } = request.headers;

            if (!authorization) {
                return reply.code(StatusCodes.UNAUTHORIZED).send({
                    error: "Missing Authorization header",
                });
            }

            try {
                const response = await fetch("https://api.github.com/user", {
                    method: "GET",
                    headers: {
                        Authorization: authorization,
                    },
                });
                const data = await response.json();

                if (!response.ok) {
                    return reply.code(response.status).send(data);
                }

                reply.code(StatusCodes.OK).send(data);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send(serializeRouteError(error));
            }
        },
    };
};
