import { FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Collection } from "mongodb";
import { SchematicRequest } from "../../types/fastify";
import { linkedInCallbackSchema } from "./linkedin.schema";
import type { LinkedInHandlerType } from "./linkedin.types";
import { exchangeLinkedInCodeForToken, fetchLinkedInUserProfile, loginOrCreateLinkedInUser } from "./linkedin.service";
import type { User } from "../users/user.model";
import { setAuthCookies } from "../auth/auth.cookies";

export const LinkedInHandler = (usersCollection: Collection<User>): LinkedInHandlerType => {
    return {
        linkedInCallback: async (request: SchematicRequest<typeof linkedInCallbackSchema>, reply: FastifyReply) => {
            try {
                const { code, redirectUri } = request.query;
                const accessToken = await exchangeLinkedInCodeForToken(code, redirectUri);
                const profile = await fetchLinkedInUserProfile(accessToken);
                const session = await loginOrCreateLinkedInUser(usersCollection, profile);

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
                    error: error instanceof Error ? error.message : "Internal server error",
                });
            }
        },
    };
};
