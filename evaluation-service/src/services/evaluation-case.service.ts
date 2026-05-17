import { normalizeEvaluationStage } from "../evaluation-case.stage.utils";
import { EvaluationCaseModel, type EvaluationCaseDocument } from "../models/evaluation-case.model";
import type { CreateEvaluationCaseBody, EvaluationCaseResponse } from "../schemas/evaluation-case.schema";

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

const toEvaluationCaseResponse = (document: EvaluationCaseDocument): EvaluationCaseResponse => {
    const normalizedStage = normalizeEvaluationStage(document.expected.stage);

    return {
        id: document.id,
        messages: document.messages,
        expected: {
            ...document.expected,
            stage: normalizedStage ?? document.expected.stage,
        },
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
    };
};

export const createEvaluationCase = async (input: CreateEvaluationCaseBody): Promise<EvaluationCaseResponse> => {
    const existing = await EvaluationCaseModel.findOne({ id: input.id }).lean();
    if (existing) {
        throw new EvaluationCaseConflictError(input.id);
    }

    const saved = await EvaluationCaseModel.create(input);
    return toEvaluationCaseResponse(saved);
};

export const listEvaluationCases = async (): Promise<EvaluationCaseResponse[]> => {
    const documents = await EvaluationCaseModel.find().sort({ createdAt: -1 });
    return documents.map(toEvaluationCaseResponse);
};

export const getEvaluationCaseById = async (caseId: string): Promise<EvaluationCaseResponse> => {
    const document = await EvaluationCaseModel.findOne({ id: caseId });
    if (!document) {
        throw new EvaluationCaseNotFoundError(caseId);
    }
    return toEvaluationCaseResponse(document);
};

export const deleteEvaluationCaseById = async (caseId: string): Promise<void> => {
    const result = await EvaluationCaseModel.deleteOne({ id: caseId });
    if (result.deletedCount === 0) {
        throw new EvaluationCaseNotFoundError(caseId);
    }
};
