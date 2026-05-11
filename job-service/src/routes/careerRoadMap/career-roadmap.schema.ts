import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { CareerRoadMapSchema, StageToDreamJobSchema } from "./career-roadmap.model";

export const getCareerRoadMapByUserIdSchema = {
    response: {
        [StatusCodes.OK]: z.array(CareerRoadMapSchema),
    },
    params: z.object({
        userId: z.string().uuid("userId must be a valid UUID"),
    }),
} satisfies FastifySchema;

export const deleteDreamJobSchema = {
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
        id: z.string().uuid("id must be a valid UUID"),
    }),
} satisfies FastifySchema;

// Added: schema for creating a new career roadmap (POST /career-roadmap)
export const createCareerRoadMapSchema = {
    response: {
        [StatusCodes.CREATED]: CareerRoadMapSchema,
    },
    body: z.object({
        userId: z.string().uuid("userId must be a valid UUID"),
        dreamJob: z.string().min(1, "dreamJob cannot be empty"),
        stagesToDreamJob: z.array(StageToDreamJobSchema),
    }),
} satisfies FastifySchema;

export const editStagesSchema = {
    response: {
        [StatusCodes.OK]: CareerRoadMapSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        id: z.string().uuid("id must be a valid UUID"),
    }),
    body: z.object({
        stagesToDreamJob: z.array(StageToDreamJobSchema),
    }),
} satisfies FastifySchema;

