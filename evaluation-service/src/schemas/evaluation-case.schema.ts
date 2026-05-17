import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { CONVERSATION_STAGE_IDS } from "../evaluation-case.stage.consts";

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

export const EvaluationMessageSchema = z.object({
    role: MessageRoleSchema,
    content: z.string().min(1),
});

export const EvaluationStageSchema = z.enum(CONVERSATION_STAGE_IDS);

/** Strict validation for create/upload requests. */
export const EvaluationExpectedInputSchema = z.object({
    stage: EvaluationStageSchema,
    maxLines: z.number().optional(),
    mustAskQuestion: z.boolean().optional(),
    forbiddenWords: z.array(z.string()).optional(),
});

/** Lenient shape for documents already stored (may include legacy stage values). */
export const EvaluationExpectedResponseSchema = z.object({
    stage: z.string().min(1),
    maxLines: z.number().optional(),
    mustAskQuestion: z.boolean().optional(),
    forbiddenWords: z.array(z.string()).optional(),
});

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
export type EvaluationStage = z.infer<typeof EvaluationStageSchema>;
export type EvaluationExpectedInput = z.infer<typeof EvaluationExpectedInputSchema>;
export type EvaluationExpectedResponse = z.infer<typeof EvaluationExpectedResponseSchema>;
/** Canonical stage id used when running evaluations. */
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

export const EvaluationCheckResultSchema = z.object({
    name: z.string(),
    passed: z.boolean(),
    expected: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
    actual: z.union([z.string(), z.number(), z.boolean()]).optional(),
    message: z.string().optional(),
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
    checks: z.array(EvaluationCheckResultSchema),
    metadata: EvaluationRunMetadataSchema,
    mode: z.string().optional(),
    stage: EvaluationStageSchema.optional(),
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
