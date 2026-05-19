import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { CONVERSATION_MODES } from "../evaluation-case.mode.consts";

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

export const EvaluationMessageSchema = z.object({
    role: MessageRoleSchema,
    content: z.string().min(1),
});

export const EvaluationModeSchema = z.enum(CONVERSATION_MODES);

const evaluationExpectedShape = {
    mode: EvaluationModeSchema.optional(),
    maxLines: z.number().optional(),
    mustAskQuestion: z.boolean().optional(),
    forbiddenWords: z.array(z.string()).optional(),
} as const;

const hasAtLeastOneExpectedCheck = (expected: {
    mode?: unknown;
    maxLines?: unknown;
    mustAskQuestion?: unknown;
    forbiddenWords?: unknown;
}): boolean =>
    expected.mode !== undefined ||
    expected.maxLines !== undefined ||
    expected.mustAskQuestion !== undefined ||
    (Array.isArray(expected.forbiddenWords) && expected.forbiddenWords.length > 0);

/** Strict validation for create/upload requests. */
export const EvaluationExpectedInputSchema = z
    .object(evaluationExpectedShape)
    .refine(hasAtLeastOneExpectedCheck, {
        message: "expected must include at least one of: mode, maxLines, mustAskQuestion, forbiddenWords",
    });

/** Lenient shape for documents already stored. */
export const EvaluationExpectedResponseSchema = z.object(evaluationExpectedShape);

export const CreateEvaluationCaseBodySchema = z.object({
    id: z.string().min(1),
    messages: z.array(EvaluationMessageSchema).min(1),
    expected: EvaluationExpectedInputSchema,
});

export const EvaluationCaseResponseSchema = z.object({
    id: z.string().min(1),
    messages: z.array(EvaluationMessageSchema),
    expected: EvaluationExpectedResponseSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const EvaluationCaseListResponseSchema = z.array(EvaluationCaseResponseSchema);

export const EvaluationCaseIdParamsSchema = z.object({
    id: z.string().min(1),
});

export const ValidationErrorResponseSchema = z.object({
    error: z.string(),
    details: z.array(z.unknown()),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type EvaluationMessage = z.infer<typeof EvaluationMessageSchema>;
export type EvaluationMode = z.infer<typeof EvaluationModeSchema>;
export type EvaluationExpectedInput = z.infer<typeof EvaluationExpectedInputSchema>;
export type EvaluationExpectedResponse = z.infer<typeof EvaluationExpectedResponseSchema>;
export type EvaluationExpected = EvaluationExpectedInput;
export type CreateEvaluationCaseBody = z.infer<typeof CreateEvaluationCaseBodySchema>;
export type EvaluationCaseResponse = z.infer<typeof EvaluationCaseResponseSchema>;

export const createEvaluationCaseRouteSchema = {
    response: {
        [StatusCodes.CREATED]: EvaluationCaseResponseSchema,
        [StatusCodes.BAD_REQUEST]: ValidationErrorResponseSchema,
        [StatusCodes.CONFLICT]: ErrorResponseSchema,
    },
} satisfies FastifySchema;

export const listEvaluationCasesRouteSchema = {
    response: {
        [StatusCodes.OK]: EvaluationCaseListResponseSchema,
    },
} satisfies FastifySchema;

export const getEvaluationCaseRouteSchema = {
    params: EvaluationCaseIdParamsSchema,
    response: {
        [StatusCodes.OK]: EvaluationCaseResponseSchema,
        [StatusCodes.NOT_FOUND]: ErrorResponseSchema,
    },
} satisfies FastifySchema;

export const deleteEvaluationCaseRouteSchema = {
    params: EvaluationCaseIdParamsSchema,
    response: {
        [StatusCodes.NO_CONTENT]: z.null(),
        [StatusCodes.NOT_FOUND]: ErrorResponseSchema,
    },
} satisfies FastifySchema;

export const replaceEvaluationCaseRouteSchema = {
    params: EvaluationCaseIdParamsSchema,
    response: {
        [StatusCodes.OK]: EvaluationCaseResponseSchema,
        [StatusCodes.BAD_REQUEST]: ValidationErrorResponseSchema,
        [StatusCodes.NOT_FOUND]: ErrorResponseSchema,
    },
} satisfies FastifySchema;

export const EvaluationCheckResultSchema = z.object({
    name: z.string(),
    passed: z.boolean(),
    expected: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
    actual: z.union([z.string(), z.number(), z.boolean()]).optional(),
    message: z.string().optional(),
});

export const EvaluationRunMessageSchema = z.object({
    role: MessageRoleSchema,
    content: z.string(),
});

export const EvaluationRunMetadataSchema = z.object({
    userId: z.string(),
    conversationId: z.string(),
    userTurnCount: z.number(),
    durationMs: z.number(),
    ranAt: z.string(),
});

export const EvaluationRunResultSchema = z.object({
    caseId: z.string(),
    runId: z.string(),
    passed: z.boolean(),
    reply: z.string(),
    conversation: z.array(EvaluationRunMessageSchema),
    checks: z.array(EvaluationCheckResultSchema),
    expected: EvaluationExpectedResponseSchema,
    metadata: EvaluationRunMetadataSchema,
    mode: z.string().optional(),
});

export type EvaluationRunResult = z.infer<typeof EvaluationRunResultSchema>;

export const runEvaluationCaseRouteSchema = {
    params: EvaluationCaseIdParamsSchema,
    response: {
        [StatusCodes.OK]: EvaluationRunResultSchema,
        [StatusCodes.BAD_REQUEST]: ErrorResponseSchema,
        [StatusCodes.NOT_FOUND]: ErrorResponseSchema,
    },
} satisfies FastifySchema;
