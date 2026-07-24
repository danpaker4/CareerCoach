import { z } from "zod";
import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";

export const StartPromptfooRunBodySchema = z.object({
    filterFirstN: z.number().int().positive().max(500).optional(),
    filterPattern: z.string().min(1).max(200).optional(),
    noCache: z.boolean().optional(),
});

export const PromptfooRunStatusSchema = z.enum(["idle", "running", "completed", "failed"]);

export const PromptfooRunOptionsSchema = z.object({
    filterFirstN: z.number().int().positive().optional(),
    filterPattern: z.string().optional(),
    noCache: z.boolean().optional(),
});

export const PromptfooRunSnapshotSchema = z.object({
    runId: z.string().nullable(),
    status: PromptfooRunStatusSchema,
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
    exitCode: z.number().int().nullable(),
    options: PromptfooRunOptionsSchema,
    logTail: z.array(z.string()),
    error: z.string().nullable(),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

export type StartPromptfooRunBody = z.infer<typeof StartPromptfooRunBodySchema>;

export const startPromptfooRunRouteSchema = {
    body: StartPromptfooRunBodySchema,
    response: {
        [StatusCodes.ACCEPTED]: PromptfooRunSnapshotSchema,
        [StatusCodes.CONFLICT]: ErrorResponseSchema,
        [StatusCodes.BAD_REQUEST]: ErrorResponseSchema,
        [StatusCodes.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
    },
} satisfies FastifySchema;

export const getPromptfooRunStatusRouteSchema = {
    response: {
        [StatusCodes.OK]: PromptfooRunSnapshotSchema,
    },
} satisfies FastifySchema;
