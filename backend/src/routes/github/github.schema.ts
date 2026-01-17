import { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import z from "zod";

export const authorizationHeaderOptionalSchema = z.string()
    .transform((v) => v.trim())
    .transform((v) => (/^bearer\s+/i.test(v) ? v : `Bearer ${v}`))
    .optional();

export const getAccessTokenGitSchema = {
    headers: z.object({
        authorization: authorizationHeaderOptionalSchema,
    }),
    response: {
        [StatusCodes.OK]: 'OK',
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },

} satisfies FastifySchema;
