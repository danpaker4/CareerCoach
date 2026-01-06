import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

export const updateUserSchema = {
    response: {
        [StatusCodes.OK]: z.object({
            message: z.string(),
            status: z.string(),
        }),
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().min(1, "userId cannot be empty"),
    }),
} satisfies FastifySchema;

