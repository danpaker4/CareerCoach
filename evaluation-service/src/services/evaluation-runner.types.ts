import type { ConversationStageId } from "../evaluation-case.stage.consts";
import type { EvaluationExpected } from "../schemas/evaluation-case.schema";

export type ChatMessageResponse = {
    reply: string;
    mode?: string;
    jobs?: unknown[];
    jobMatches?: unknown[];
    recommendedDirections?: unknown[];
    confidenceSummary?: unknown;
};

export type EvaluationCheckResult = {
    name: string;
    passed: boolean;
    expected?: string | number | boolean | string[];
    actual?: string | number | boolean;
    message?: string;
};

export type EvaluationRunMetadata = {
    userId: string;
    conversationId: string;
    userTurnCount: number;
    durationMs: number;
    ranAt: string;
};

export type EvaluationRunResult = {
    caseId: string;
    runId: string;
    passed: boolean;
    reply: string;
    checks: EvaluationCheckResult[];
    metadata: EvaluationRunMetadata;
    stage?: ConversationStageId;
    mode?: string;
};

export type RunEvaluationCaseParams = {
    caseId: string;
    messages: Array<{ role: string; content: string }>;
    expected: EvaluationExpected;
};
