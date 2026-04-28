import { FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Collection } from "mongodb";
import { SchematicRequest } from "../../types/fastify";
import { githubCallbackSchema } from "./github.schema";
import type { GithubHandlerType } from "./github.types";
import { exchangeCodeForAccessToken, fetchGithubUserEmails, fetchGithubUserProfile, loginOrCreateGithubUser } from "./github.service";
import type { User } from "../users/user.model";
import { setAuthCookies } from "../auth/auth.cookies";

export const GithubHandler = (usersCollection: Collection<User>): GithubHandlerType => {
    return {
        githubCallback: async (request: SchematicRequest<typeof githubCallbackSchema>, reply: FastifyReply) => {
            try {
                const { code, redirectUri } = request.query;
                const accessToken = await exchangeCodeForAccessToken(code, redirectUri);
                const [profile, emails] = await Promise.all([
                    fetchGithubUserProfile(accessToken),
                    fetchGithubUserEmails(accessToken)
                ]);

                const session = await loginOrCreateGithubUser(usersCollection, profile, emails);

                setAuthCookies(reply, {
                    accessToken: session.accessToken,
                    refreshToken: session.refreshToken,
                });

                reply.code(StatusCodes.OK).send({
                    success: true,
                    user: session.user,
                    accessToken: session.accessToken,
                });
            } catch (error) {
                console.error(error);
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
                    error: error instanceof Error ? error.message : "Internal server error"
                });
            }
        },
    };
};
