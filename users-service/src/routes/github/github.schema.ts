import { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import z from "zod";
import { UserSchema } from "../users/user.model";

const authErrorSchema = z.object({
    error: z.string(),
    errorCode: z.string().optional(),
});

export const githubCallbackSchema = {
    querystring: z.object({
        code: z.string(),
        redirectUri: z.string().url(),
    }),
    response: {
        [StatusCodes.OK]: z.object({
            success: z.boolean(),
            user: UserSchema,
            accessToken: z.string(),
        }),
        [StatusCodes.BAD_REQUEST]: z.object({
            error: z.string(),
        }),
        [StatusCodes.INTERNAL_SERVER_ERROR]: z.object({
            error: z.string(),
        }),
    },
} satisfies FastifySchema;

export const githubLinkSchema = {
    querystring: z.object({
        code: z.string(),
        redirectUri: z.string().url(),
    }),
    response: {
        [StatusCodes.OK]: z.object({
            success: z.boolean(),
            user: UserSchema,
        }),
        [StatusCodes.BAD_REQUEST]: z.object({
            error: z.string(),
        }),
        [StatusCodes.UNAUTHORIZED]: authErrorSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
        [StatusCodes.INTERNAL_SERVER_ERROR]: z.object({
            error: z.string(),
        }),
    },
} satisfies FastifySchema;
