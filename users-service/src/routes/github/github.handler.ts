import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Collection } from "mongodb";
import { SchematicRequest } from "../../types/fastify";
import { githubCallbackSchema, githubLinkSchema } from "./github.schema";
import type { GithubHandlerType } from "./github.types";
import {
    exchangeCodeForAccessToken,
    fetchGithubUserEmails,
    fetchGithubUserProfile,
    linkGithubSkillsToUser,
    loginOrCreateGithubUser,
} from "./github.service";
import type { UserDocument } from "../users/user.model";
import { setAuthCookies } from "../auth/auth.cookies";

export const GithubHandler = (usersCollection: Collection<UserDocument>): GithubHandlerType => {
    return {
        githubCallback: async (request: SchematicRequest<typeof githubCallbackSchema>, reply: FastifyReply) => {
            try {
                const { code, redirectUri } = request.query;
                const accessToken = await exchangeCodeForAccessToken(code, redirectUri);
                const [profile, emails] = await Promise.all([
                    fetchGithubUserProfile(accessToken),
                    fetchGithubUserEmails(accessToken)
                ]);

                const session = await loginOrCreateGithubUser(usersCollection, accessToken, profile, emails);

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
        githubLink: async (
            request: SchematicRequest<typeof githubLinkSchema> & Pick<FastifyRequest, "authUser">,
            reply: FastifyReply,
        ) => {
            try {
                const authUser = request.authUser;
                if (!authUser) {
                    reply
                        .code(StatusCodes.UNAUTHORIZED)
                        .send({ error: "Authentication is required", errorCode: "ACCESS_TOKEN_MISSING" });
                    return;
                }

                const { code, redirectUri } = request.query;
                const accessToken = await exchangeCodeForAccessToken(code, redirectUri);
                const profile = await fetchGithubUserProfile(accessToken);
                const result = await linkGithubSkillsToUser(usersCollection, authUser.userId, accessToken, profile);

                if (result.status === "not_found") {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "User not found" });
                    return;
                }

                if (result.status === "github_in_use") {
                    reply
                        .code(StatusCodes.BAD_REQUEST)
                        .send({ error: "This GitHub account is already linked to another user" });
                    return;
                }

                reply.code(StatusCodes.OK).send({
                    success: true,
                    user: result.user,
                });
            } catch (error) {
                console.error(error);
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
                    error: error instanceof Error ? error.message : "Internal server error",
                });
            }
        },
    };
};
