import { randomUUID } from "crypto";
import { type ConversationStageId } from "../evaluation-case.stage.consts";
import { isConversationStageId, normalizeEvaluationStage } from "../evaluation-case.stage.utils";
import type { RunnerConfig } from "../server.types";
import type { EvaluationCaseResponse } from "../schemas/evaluation-case.schema";
import { getEvaluationCaseById } from "./evaluation-case.service";
import {
    aggregatePassed,
    evaluateAssistantReply,
    extractUserMessages,
} from "./evaluation-runner.utils";
import type { ChatMessageResponse, EvaluationRunResult } from "./evaluation-runner.types";

export class EvaluationRunnerError extends Error {
    constructor(
        readonly statusCode: number,
        message: string,
    ) {
        super(message);
        this.name = "EvaluationRunnerError";
    }
}

type ConversationCreateResponse = {
    conversationId: string;
};

const parseJsonResponse = async (response: Response): Promise<unknown> => response.json().catch(() => null);

const readChatErrorMessage = async (response: Response): Promise<string> => {
    const payload = await parseJsonResponse(response);
    if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
        return payload.error;
    }
    return `Chat service responded with status ${response.status}`;
};

const isChatMessageResponse = (value: unknown): value is ChatMessageResponse =>
    typeof value === "object" &&
    value !== null &&
    "reply" in value &&
    typeof (value as ChatMessageResponse).reply === "string";

const isConversationCreateResponse = (value: unknown): value is ConversationCreateResponse =>
    typeof value === "object" &&
    value !== null &&
    "conversationId" in value &&
    typeof (value as ConversationCreateResponse).conversationId === "string";

const createEvaluationConversation = async (config: RunnerConfig): Promise<string> => {
    const response = await fetch(
        `${config.chatServiceBaseUrl}/chat/users/${encodeURIComponent(config.evaluationUserId)}/conversations`,
        { method: "POST" },
    );

    if (!response.ok) {
        throw new EvaluationRunnerError(response.status, await readChatErrorMessage(response));
    }

    const payload = await parseJsonResponse(response);
    if (!isConversationCreateResponse(payload)) {
        throw new EvaluationRunnerError(502, "Chat service returned an invalid conversation response");
    }

    return payload.conversationId;
};

const sendChatMessage = async (
    config: RunnerConfig,
    conversationId: string,
    message: string,
): Promise<ChatMessageResponse> => {
    const response = await fetch(`${config.chatServiceBaseUrl}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: config.evaluationUserId,
            conversationId,
            message,
        }),
    });

    if (!response.ok) {
        throw new EvaluationRunnerError(response.status, await readChatErrorMessage(response));
    }

    const payload = await parseJsonResponse(response);
    if (!isChatMessageResponse(payload)) {
        throw new EvaluationRunnerError(502, "Chat service returned an invalid message response");
    }

    return payload;
};

const replayUserTurns = async (
    config: RunnerConfig,
    conversationId: string,
    userMessages: string[],
): Promise<ChatMessageResponse> => {
    const sendAllExceptLast = userMessages.slice(0, -1);
    const lastMessage = userMessages[userMessages.length - 1];

    for (const userMessage of sendAllExceptLast) {
        await sendChatMessage(config, conversationId, userMessage);
    }

    return sendChatMessage(config, conversationId, lastMessage);
};

type ConversationFetchResponse = {
    conversationId: string;
    currentStageId: string | null;
};

const isConversationFetchResponse = (value: unknown): value is ConversationFetchResponse =>
    typeof value === "object" &&
    value !== null &&
    "conversationId" in value &&
    "currentStageId" in value &&
    (typeof (value as ConversationFetchResponse).currentStageId === "string" ||
        (value as ConversationFetchResponse).currentStageId === null);

const fetchConversationCurrentStage = async (config: RunnerConfig, conversationId: string): Promise<ConversationStageId | undefined> => {
    const params = new URLSearchParams({ conversationId });
    const response = await fetch(
        `${config.chatServiceBaseUrl}/chat/${encodeURIComponent(config.evaluationUserId)}?${params.toString()}`,
    );

    if (!response.ok) {
        throw new EvaluationRunnerError(response.status, await readChatErrorMessage(response));
    }

    const payload = await parseJsonResponse(response);
    if (!isConversationFetchResponse(payload)) {
        throw new EvaluationRunnerError(502, "Chat service returned an invalid conversation response");
    }

    const stageId = payload.currentStageId;
    return stageId && isConversationStageId(stageId) ? stageId : undefined;
};

export const runEvaluationCaseById = async (config: RunnerConfig, caseId: string): Promise<EvaluationRunResult> => {
    const startedAt = Date.now();
    const evaluationCase: EvaluationCaseResponse = await getEvaluationCaseById(caseId);
    const expectedStage = normalizeEvaluationStage(evaluationCase.expected.stage);
    const userMessages = extractUserMessages(evaluationCase.messages);

    if (!expectedStage) {
        throw new EvaluationRunnerError(
            400,
            `Invalid expected.stage "${evaluationCase.expected.stage}". Use one of: achievements, timeline, preferences`,
        );
    }

    if (userMessages.length === 0) {
        throw new EvaluationRunnerError(400, "Evaluation case must include at least one user message");
    }

    const conversationId = await createEvaluationConversation(config);
    const finalChatResponse = await replayUserTurns(config, conversationId, userMessages);
    const actualStage = await fetchConversationCurrentStage(config, conversationId);
    const checks = evaluateAssistantReply({
        reply: finalChatResponse.reply,
        expected: { ...evaluationCase.expected, stage: expectedStage },
        actualStage,
    });

    return {
        caseId: evaluationCase.id,
        runId: randomUUID(),
        passed: aggregatePassed(checks),
        reply: finalChatResponse.reply,
        checks,
        stage: actualStage,
        mode: finalChatResponse.mode,
        metadata: {
            userId: config.evaluationUserId,
            conversationId,
            userTurnCount: userMessages.length,
            durationMs: Date.now() - startedAt,
            ranAt: new Date().toISOString(),
        },
    };
};
