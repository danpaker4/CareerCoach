import type { TextCompletionPort } from "./text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../ai/token-usage/token-usage.types";
import { readOpenAiUsage, recordLlmTokenUsage, toLlmErrorMessage } from "../../ai/token-usage/utils/token-usage.utils";
import { withSpan } from "../../observability/tracing";
import { formatLiteLlmErrorMessage, isLiteLlmChatResponse } from "./litellm-response.utils";
import { LITELLM_CHAT_COMPLETIONS_PATH } from "./litellm-text-completion.consts";

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

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> =>
        await withSpan("llm.complete", {
            "llm.provider": "litellm",
            "llm.model": this.model,
            "llm.operation": context?.operation ?? "chat.text_completion",
            ...(context?.userId ? { "enduser.id": context.userId } : {}),
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

                const text = payload.choices?.[0]?.message?.content;
                if (typeof text !== "string" || text.trim().length === 0) {
                    throw new Error("LiteLLM returned empty completion");
                }

                const usage = readOpenAiUsage(payload);
                span.setAttributes({
                    "llm.request.status": "success",
                    "llm.usage.prompt_tokens": usage?.promptTokens ?? 0,
                    "llm.usage.completion_tokens": usage?.completionTokens ?? 0,
                    "llm.usage.total_tokens": usage?.totalTokens ?? 0,
                });
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
