import { EvaluationCaseModel } from "../models/evaluation-case.model";
import type { CreateEvaluationCaseBody, EvaluationCaseResponse, EvaluationExpectedResponse } from "../schemas/evaluation-case.schema";

export class EvaluationCaseConflictError extends Error {
    constructor(readonly caseId: string) {
        super(`Evaluation case with id "${caseId}" already exists`);
        this.name = "EvaluationCaseConflictError";
    }
}

export class EvaluationCaseNotFoundError extends Error {
    constructor(readonly caseId: string) {
        super(`Evaluation case with id "${caseId}" not found`);
        this.name = "EvaluationCaseNotFoundError";
    }
}

export class EvaluationCaseRequestIdMismatchError extends Error {
    constructor(
        readonly pathCaseId: string,
        readonly bodyCaseId: string,
    ) {
        super(`Path id "${pathCaseId}" does not match body id "${bodyCaseId}"`);
        this.name = "EvaluationCaseRequestIdMismatchError";
    }
}

const toEvaluationCaseResponse = (document: {
    id: string;
    messages: EvaluationCaseResponse["messages"];
    expected: EvaluationExpectedResponse;
    createdAt: Date;
    updatedAt: Date;
}): EvaluationCaseResponse => ({
    id: document.id,
    messages: document.messages,
    expected: document.expected,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
});

export const createEvaluationCase = async (input: CreateEvaluationCaseBody): Promise<EvaluationCaseResponse> => {
    const existing = await EvaluationCaseModel.findOne({ id: input.id }).lean();
    if (existing) {
        throw new EvaluationCaseConflictError(input.id);
    }

    const saved = await EvaluationCaseModel.create(input);
    return toEvaluationCaseResponse(saved.toObject());
};

export const listEvaluationCases = async (): Promise<EvaluationCaseResponse[]> => {
    const documents = await EvaluationCaseModel.find().sort({ createdAt: -1 }).lean();
    return documents.map(toEvaluationCaseResponse);
};

export const getEvaluationCaseById = async (caseId: string): Promise<EvaluationCaseResponse> => {
    const document = await EvaluationCaseModel.findOne({ id: caseId }).lean();
    if (!document) {
        throw new EvaluationCaseNotFoundError(caseId);
    }
    return toEvaluationCaseResponse(document);
};

export const replaceEvaluationCaseById = async (
    caseId: string,
    input: CreateEvaluationCaseBody,
): Promise<EvaluationCaseResponse> => {
    if (input.id !== caseId) {
        throw new EvaluationCaseRequestIdMismatchError(caseId, input.id);
    }

    const updated = await EvaluationCaseModel.findOneAndUpdate({ id: caseId }, input, {
        new: true,
        runValidators: true,
        lean: true,
    });

    if (!updated) {
        throw new EvaluationCaseNotFoundError(caseId);
    }

    return toEvaluationCaseResponse(updated);
};

export const deleteEvaluationCaseById = async (caseId: string): Promise<void> => {
    const result = await EvaluationCaseModel.deleteOne({ id: caseId });
    if (result.deletedCount === 0) {
        throw new EvaluationCaseNotFoundError(caseId);
    }
};
