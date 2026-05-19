import { randomUUID } from "crypto";
import type { RunnerConfig } from "../server.types";
import type { EvaluationCaseResponse, EvaluationExpected } from "../schemas/evaluation-case.schema";
import { CONVERSATION_MODES } from "../evaluation-case.mode.consts";
import { getEvaluationCaseById } from "./evaluation-case.service";
import {
    aggregatePassed,
    evaluateAssistantReply,
    extractUserMessages,
    hasCheckableExpected,
} from "./evaluation-runner.utils";
import type { ChatMessageResponse, EvaluationRunMessage, EvaluationRunResult } from "./evaluation-runner.types";

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

const isConversationMode = (value: string): value is NonNullable<EvaluationExpected["mode"]> =>
    (CONVERSATION_MODES as readonly string[]).includes(value);

type ConversationMessagesResponse = {
    messages: Array<{
        role: string;
        content: string;
    }>;
};

const isConversationMessagesResponse = (value: unknown): value is ConversationMessagesResponse =>
    typeof value === "object" &&
    value !== null &&
    "messages" in value &&
    Array.isArray((value as ConversationMessagesResponse).messages);

const isEvaluationRunMessageRole = (role: string): role is EvaluationRunMessage["role"] =>
    role === "user" || role === "assistant" || role === "system";

const fetchRunConversation = async (config: RunnerConfig, conversationId: string): Promise<EvaluationRunMessage[]> => {
    const params = new URLSearchParams({ conversationId });
    const response = await fetch(
        `${config.chatServiceBaseUrl}/chat/${encodeURIComponent(config.evaluationUserId)}?${params.toString()}`,
    );

    if (!response.ok) {
        throw new EvaluationRunnerError(response.status, await readChatErrorMessage(response));
    }

    const payload = await parseJsonResponse(response);
    if (!isConversationMessagesResponse(payload)) {
        throw new EvaluationRunnerError(502, "Chat service returned an invalid conversation messages response");
    }

    return payload.messages.flatMap((message) => {
        if (!isEvaluationRunMessageRole(message.role) || typeof message.content !== "string" || message.content.trim().length === 0) {
            return [];
        }

        return [{ role: message.role, content: message.content }];
    });
};

const normalizeExpectedForRun = (expected: EvaluationCaseResponse["expected"]): EvaluationExpected => {
    const normalizedMode =
        expected.mode && isConversationMode(expected.mode.toUpperCase())
            ? (expected.mode.toUpperCase() as EvaluationExpected["mode"])
            : undefined;

    return {
        maxLines: expected.maxLines,
        mustAskQuestion: expected.mustAskQuestion,
        forbiddenWords: expected.forbiddenWords,
        mode: normalizedMode,
    };
};

export const runEvaluationCaseById = async (config: RunnerConfig, caseId: string): Promise<EvaluationRunResult> => {
    const startedAt = Date.now();
    const evaluationCase: EvaluationCaseResponse = await getEvaluationCaseById(caseId);
    const expectedForRun = normalizeExpectedForRun(evaluationCase.expected);
    const userMessages = extractUserMessages(evaluationCase.messages);

    if (!hasCheckableExpected(expectedForRun)) {
        throw new EvaluationRunnerError(
            400,
            "Evaluation case expected must include at least one of: mode, maxLines, mustAskQuestion, forbiddenWords",
        );
    }

    if (userMessages.length === 0) {
        throw new EvaluationRunnerError(400, "Evaluation case must include at least one user message");
    }

    const conversationId = await createEvaluationConversation(config);
    const finalChatResponse = await replayUserTurns(config, conversationId, userMessages);
    const conversation = await fetchRunConversation(config, conversationId);
    const checks = evaluateAssistantReply({
        reply: finalChatResponse.reply,
        expected: expectedForRun,
        actualMode: finalChatResponse.mode,
    });

    return {
        caseId: evaluationCase.id,
        runId: randomUUID(),
        passed: aggregatePassed(checks),
        reply: finalChatResponse.reply,
        conversation,
        checks,
        expected: expectedForRun,
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
