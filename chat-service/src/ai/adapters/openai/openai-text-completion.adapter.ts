import type { TextCompletionPort } from "../../ports/text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../token-usage.types";
import { readOpenAiUsage, recordLlmTokenUsage, toLlmErrorMessage } from "../../token-usage.utils";
import { withSpan } from "../../../observability/tracing";
import { OPENAI_CHAT_COMPLETIONS_URL } from "./openai-text-completion.consts";
import { formatOpenAiErrorMessage, isOpenAiChatResponse } from "./openai-text-completion.utils";

export class OpenAiTextCompletionAdapter implements TextCompletionPort {
    constructor(
        private readonly apiKey: string,
        private readonly model: string,
        private readonly tokenUsageRecorder?: LlmTokenUsageRecorder
    ) { }

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> =>
        await withSpan("llm.complete", {
            "llm.provider": "openai",
            "llm.model": this.model,
            "llm.operation": context?.operation ?? "chat.text_completion",
            ...(context?.userId ? { "enduser.id": context.userId } : {}),
        }, async (span) => {
            console.info(`[LLM] Sending request provider=openai model=${this.model}`);
            try {
                const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
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
                    throw new Error(`OpenAI completion failed: ${formatOpenAiErrorMessage(payload, response.statusText)}`);
                }

                if (!isOpenAiChatResponse(payload)) {
                    throw new Error("OpenAI returned invalid response shape");
                }

                const text = payload.choices?.[0]?.message?.content;
                if (typeof text !== "string" || text.trim().length === 0) {
                    throw new Error("OpenAI returned empty completion");
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
                    provider: "openai",
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
                    provider: "openai",
                    model: this.model,
                    usage: null,
                    requestStatus: "error",
                    errorMessage: toLlmErrorMessage(error),
                });
                throw error;
            }
        });
}
