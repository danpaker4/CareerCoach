import type { TextCompletionPort } from "../../ports/text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../token-usage.types";
import { readOpenAiUsage, recordLlmTokenUsage, toLlmErrorMessage } from "../../token-usage.utils";
import { withSpan } from "../../../observability/tracing";
import { formatOpenAiErrorMessage, isOpenAiChatResponse } from "../openai/openai-text-completion.utils";
import { LITELLM_CHAT_COMPLETIONS_PATH } from "./http-litellm-text-completion.consts";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

export class HttpLiteLlmTextCompletionAdapter implements TextCompletionPort {
    private readonly completionsUrl: string;

    constructor(
        endpointUrl: string,
        private readonly apiKey: string,
        private readonly model: string,
        private readonly tokenUsageRecorder?: LlmTokenUsageRecorder
    ) {
        this.completionsUrl = `${trimTrailingSlashes(endpointUrl)}${LITELLM_CHAT_COMPLETIONS_PATH}`;
    }

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> =>
        await withSpan("llm.complete", {
            "llm.provider": "litellm",
            "llm.model": this.model,
            "llm.operation": context?.operation ?? "chat.text_completion",
            ...(context?.userId ? { "enduser.id": context.userId } : {}),
        }, async (span) => {
            console.info(`[LLM] Sending request provider=litellm model=${this.model}`);
            try {
                const response = await fetch(this.completionsUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.3,
                    }),
                });

                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(`LiteLLM completion failed: ${formatOpenAiErrorMessage(payload, response.statusText)}`);
                }

                if (!isOpenAiChatResponse(payload)) {
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
                span.setAttribute("llm.request.status", "error");
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "chat-service",
                    operation: context?.operation ?? "chat.text_completion",
                    userId: context?.userId,
                    provider: "litellm",
                    model: this.model,
                    usage: null,
                    requestStatus: "error",
                    errorMessage: toLlmErrorMessage(error),
                });
                throw error;
            }
        });
}
