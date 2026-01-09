import { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import z from "zod";

export const getAccessTokenGitSchema = {
    response: {
        [StatusCodes.OK]: 'OK',
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },

} satisfies FastifySchema;