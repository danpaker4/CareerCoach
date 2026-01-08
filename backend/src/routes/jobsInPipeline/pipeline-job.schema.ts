import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { PipelineJobSchema } from "./pipeline-job.model";

export const getPipelineJobsByUserIdSchema = {
    response: {
        [StatusCodes.OK]: z.array(PipelineJobSchema),
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().uuid("userId must be a valid UUID"),
    }),
} satisfies FastifySchema;

export const createPipelineJobSchema = {
    response: {
        [StatusCodes.CREATED]: PipelineJobSchema,
        [StatusCodes.BAD_REQUEST]: z.object({
            error: z.string(),
        }),
    },
    body: PipelineJobSchema.omit({ id: true }),
} satisfies FastifySchema;

export const updatePipelineJobStageSchema = {
    response: {
        [StatusCodes.OK]: PipelineJobSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        id: z.string().uuid("id must be a valid UUID"),
    }),
    body: z.object({
        jobStage: z.string().min(1, "jobStage cannot be empty"),
    }),
} satisfies FastifySchema;

export const updatePipelineJobDescriptionSchema = {
    response: {
        [StatusCodes.OK]: PipelineJobSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        id: z.string().uuid("id must be a valid UUID"),
    }),
    body: z.object({
        description: z.string().min(1, "description cannot be empty"),
    }),
} satisfies FastifySchema;

export const deletePipelineJobSchema = {
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


