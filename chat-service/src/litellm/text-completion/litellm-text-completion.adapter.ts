import type { TextCompletionContext, TextCompletionPort } from "./text-completion.types";
import type { LlmTokenUsageRecorder } from "../../ai/token-usage/token-usage.types";
import { readOpenAiUsage, recordLlmTokenUsage, toLlmErrorMessage } from "../../ai/token-usage/utils/token-usage.utils";
import {
    createLangfuseContentAttributes,
    createLangfuseObservationAttributes,
    createLangfuseUsageAttributes,
    withSpan,
} from "../../observability/tracing";
import { formatLiteLlmErrorMessage, isLiteLlmChatResponse } from "./litellm-response.utils";
import { LITELLM_CHAT_COMPLETIONS_PATH, MAX_CHAT_COMPLETION_TOKENS } from "./litellm-text-completion.consts";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const isNetworkError = (error: unknown): boolean => {
    if (!(error instanceof Error)) {
        return false;
    }
    const cause = "cause" in error ? error.cause : undefined;
    const causeCode =
        typeof cause === "object" && cause !== null && "code" in cause
            ? String((cause as { code: unknown }).code)
            : undefined;
    return (
        error.name === "TypeError" ||
        error.message.includes("fetch failed") ||
        causeCode === "ECONNREFUSED" ||
        causeCode === "ENOTFOUND" ||
        causeCode === "ECONNRESET"
    );
};

export class LiteLlmTextCompletionAdapter implements TextCompletionPort {
    private readonly completionsUrl: string;

    constructor(
        private readonly baseUrl: string,
        private readonly model: string,
        private readonly apiKey: string | undefined,
        private readonly tokenUsageRecorder?: LlmTokenUsageRecorder
    ) {
        this.completionsUrl = `${trimTrailingSlashes(baseUrl)}${LITELLM_CHAT_COMPLETIONS_PATH}`;
    }

    readonly complete = async (prompt: string, context?: TextCompletionContext): Promise<string> =>
        await withSpan("llm.complete", {
            "llm.provider": "litellm",
            "llm.model": this.model,
            "llm.operation": context?.operation ?? "chat.text_completion",
            ...(context?.userId ? { "enduser.id": context.userId } : {}),
            ...createLangfuseObservationAttributes({
                operation: context?.operation ?? "chat.text_completion",
                type: "generation",
                feature: context?.feature ?? "chat",
                provider: "litellm",
                model: this.model,
                userId: context?.userId,
                sessionId: context?.sessionId,
            }),
        }, async (span) => {
            console.info(`[LLM] Sending request provider=litellm model=${this.model} baseUrl=${this.baseUrl}`);
            try {
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };
                if (this.apiKey) {
                    headers.Authorization = `Bearer ${this.apiKey}`;
                }

                const response = await fetch(this.completionsUrl, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        model: this.model,
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.3,
                        max_tokens: MAX_CHAT_COMPLETION_TOKENS,
                        ...(context?.responseFormat === "json"
                            ? { response_format: { type: "json_object" } }
                            : {}),
                    }),
                });

                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(
                        `LiteLLM completion failed: ${formatLiteLlmErrorMessage(payload, response.statusText)}`
                    );
                }

                if (!isLiteLlmChatResponse(payload)) {
                    throw new Error("LiteLLM returned invalid response shape");
                }

                const firstChoice = payload.choices?.[0];
                const text = firstChoice?.message?.content;
                if (typeof text !== "string" || text.trim().length === 0) {
                    throw new Error("LiteLLM returned empty completion");
                }

                const usage = readOpenAiUsage(payload);
                const finishReason = typeof firstChoice?.finish_reason === "string"
                    ? firstChoice.finish_reason
                    : "unknown";
                const responseModel = typeof payload.model === "string" && payload.model.trim().length > 0
                    ? payload.model
                    : this.model;
                span.setAttributes({
                    "llm.request.status": "success",
                    "llm.response.model": responseModel,
                    "llm.response.finish_reason": finishReason,
                    "gen_ai.response.model": responseModel,
                    "gen_ai.response.finish_reasons": [finishReason],
                    "langfuse.observation.metadata.response_model": responseModel,
                    "langfuse.observation.metadata.finish_reason": finishReason,
                    "llm.usage.prompt_tokens": usage?.promptTokens ?? 0,
                    "llm.usage.completion_tokens": usage?.completionTokens ?? 0,
                    "llm.usage.total_tokens": usage?.totalTokens ?? 0,
                    ...createLangfuseUsageAttributes(usage),
                    ...createLangfuseContentAttributes(prompt, text),
                });
                console.info(JSON.stringify({
                    event: "llm.completion",
                    status: "success",
                    operation: context?.operation ?? "chat.text_completion",
                    requestedModel: this.model,
                    responseModel,
                    finishReason,
                    responseChars: text.length,
                }));
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "chat-service",
                    operation: context?.operation ?? "chat.text_completion",
                    userId: context?.userId,
                    provider: "litellm",
                    model: this.model,
                    usage,
                    requestStatus: "success",
                });
                return text;
            } catch (error: unknown) {
                const wrappedError = isNetworkError(error)
                    ? new Error(`LiteLLM is unavailable at ${this.baseUrl}: ${toLlmErrorMessage(error)}`)
                    : error;

                span.setAttribute("llm.request.status", "error");
                span.setAttribute("langfuse.observation.status_message", toLlmErrorMessage(wrappedError).slice(0, 500));
                console.error(JSON.stringify({
                    event: "llm.completion",
                    status: "error",
                    operation: context?.operation ?? "chat.text_completion",
                    requestedModel: this.model,
                    error: toLlmErrorMessage(wrappedError).slice(0, 500),
                }));
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "chat-service",
                    operation: context?.operation ?? "chat.text_completion",
                    userId: context?.userId,
                    provider: "litellm",
                    model: this.model,
                    usage: null,
                    requestStatus: "error",
                    errorMessage: toLlmErrorMessage(wrappedError),
                });
                throw wrappedError;
            }
        });
}
