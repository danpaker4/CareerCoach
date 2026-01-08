import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { SkillMatcherSchema, SkillToImproveSchema } from "./skill-matcher.model";

export const getSkillMatcherByUserIdSchema = {
    response: {
        [StatusCodes.OK]: z.array(SkillMatcherSchema),
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().uuid("userId must be a valid UUID"),
    }),
} satisfies FastifySchema;

export const addSkillSchema = {
    response: {
        [StatusCodes.OK]: SkillMatcherSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        id: z.string().uuid("id must be a valid UUID"),
    }),
    body: SkillToImproveSchema,
} satisfies FastifySchema;

export const editSkillSchema = {
    response: {
        [StatusCodes.OK]: SkillMatcherSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().uuid("userId must be a valid UUID"),
        jobId: z.string().transform((val) => parseInt(val, 10)),
        skill: z.string().min(1, "skill cannot be empty"),
    }),
    body: z.object({
        isDone: z.boolean(),
    }),
} satisfies FastifySchema;