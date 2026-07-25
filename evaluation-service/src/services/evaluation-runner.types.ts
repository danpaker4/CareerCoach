import type { EvaluationExpected, EvaluationMessage } from "../schemas/evaluation-case.schema";

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

export type EvaluationTokenUsage = {
    prompt: number;
    completion: number;
    total: number;
    requestCount: number;
};

export type EvaluationRunMessage = EvaluationMessage;

export type EvaluationRunResult = {
    caseId: string;
    runId: string;
    passed: boolean;
    reply: string;
    conversation: EvaluationRunMessage[];
    checks: EvaluationCheckResult[];
    expected: EvaluationExpected;
    metadata: EvaluationRunMetadata;
    mode?: string;
    /** Number of jobs / job matches returned with the final assistant reply. */
    jobCount?: number;
    /** LLM tokens consumed for this run (from chat-service llmTokenUsage). */
    tokenUsage?: EvaluationTokenUsage;
};

export type RunEvaluationCaseParams = {
    caseId: string;
    messages: Array<{ role: string; content: string }>;
    expected: EvaluationExpected;
};
