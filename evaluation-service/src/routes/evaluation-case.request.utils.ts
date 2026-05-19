import type { FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
    CreateEvaluationCaseBodySchema,
    type CreateEvaluationCaseBody,
} from "../schemas/evaluation-case.schema";

const EVALUATION_CASE_FILE_FIELD = "file";

export class EvaluationCaseRequestError extends Error {
    constructor(
        readonly statusCode: number,
        message: string,
        readonly details?: unknown[],
    ) {
        super(message);
        this.name = "EvaluationCaseRequestError";
    }
}

const parseJsonEvaluationCase = (value: unknown): CreateEvaluationCaseBody => {
    const result = CreateEvaluationCaseBodySchema.safeParse(value);
    if (!result.success) {
        throw new EvaluationCaseRequestError(400, "Validation failed", result.error.issues);
    }
    return result.data;
};

const readJsonFileFromMultipart = async (request: FastifyRequest): Promise<CreateEvaluationCaseBody> => {
    const parts = request.parts();
    for await (const part of parts) {
        if (part.type !== "file" || part.fieldname !== EVALUATION_CASE_FILE_FIELD) {
            continue;
        }

        const buffer = await part.toBuffer();
        const fileText = buffer.toString("utf8").trim();
        if (fileText.length === 0) {
            throw new EvaluationCaseRequestError(400, "Uploaded JSON file is empty");
        }

        const parsed: unknown = (() => {
            try {
                return JSON.parse(fileText) as unknown;
            } catch {
                throw new EvaluationCaseRequestError(400, "Uploaded file must contain valid JSON");
            }
        })();

        return parseJsonEvaluationCase(parsed);
    }

    throw new EvaluationCaseRequestError(
        400,
        `Multipart request must include a JSON file in the "${EVALUATION_CASE_FILE_FIELD}" field`,
    );
};

export const parseCreateEvaluationCaseInput = async (request: FastifyRequest): Promise<CreateEvaluationCaseBody> => {
    if (request.isMultipart()) {
        return readJsonFileFromMultipart(request);
    }

    if (request.body !== undefined && request.body !== null) {
        return parseJsonEvaluationCase(request.body);
    }

    throw new EvaluationCaseRequestError(
        400,
        'Request must be multipart/form-data with a JSON file field "file", or application/json body',
    );
};

export const isEvaluationCaseRequestError = (error: unknown): error is EvaluationCaseRequestError =>
    error instanceof EvaluationCaseRequestError;

export const formatEvaluationCaseRequestError = (error: unknown): { error: string; details?: unknown[] } => {
    if (error instanceof EvaluationCaseRequestError) {
        return error.details ? { error: error.message, details: error.details } : { error: error.message };
    }

    if (error instanceof ZodError) {
        return { error: "Validation failed", details: error.issues };
    }

    return { error: error instanceof Error ? error.message : "Invalid request" };
};
