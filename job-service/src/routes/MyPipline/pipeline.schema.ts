import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { PipelineSchema } from "./pipeline.model";

export const getPipelineByUserIdSchema = {
    response: {
        [StatusCodes.OK]: PipelineSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().min(1, "userId cannot be empty"),
    }),
} satisfies FastifySchema;

export const addStageSchema = {
    response: {
        [StatusCodes.OK]: PipelineSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().min(1, "userId cannot be empty"),
    }),
    body: z.object({
        stage: z.string().min(1, "stage cannot be empty"),
    }),
} satisfies FastifySchema;

export const deleteStageSchema = {
    response: {
        [StatusCodes.OK]: PipelineSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().min(1, "userId cannot be empty"),
        stage: z.string().min(1, "stage cannot be empty"),
    }),
} satisfies FastifySchema;

export const deletePipelineSchema = {
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

