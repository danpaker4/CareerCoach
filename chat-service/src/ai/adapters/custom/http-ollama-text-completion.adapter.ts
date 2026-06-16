import type { TextCompletionPort } from "../../ports/text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../token-usage.types";
import { DEFAULT_OLLAMA_TIMEOUT_MS } from "../../llm-config.consts";
import { readOllamaUsage, recordLlmTokenUsage, toLlmErrorMessage } from "../../token-usage.utils";
import { withSpan } from "../../../observability/tracing";

type OllamaGenerateResponse = {
    response?: string;
};

const isOllamaGenerateResponse = (value: unknown): value is OllamaGenerateResponse =>
    typeof value === "object" && value !== null && "response" in value;

export class HttpOllamaTextCompletionAdapter implements TextCompletionPort {
    constructor(
        private readonly baseUrl: string,
        private readonly model: string,
        private readonly tokenUsageRecorder?: LlmTokenUsageRecorder
    ) { }

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> =>
        await withSpan("llm.complete", {
            "llm.provider": "ollama",
            "llm.model": this.model,
            "llm.operation": context?.operation ?? "chat.text_completion",
            ...(context?.userId ? { "enduser.id": context.userId } : {}),
        }, async (span) => {
            console.info(`[LLM] Sending request provider=ollama model=${this.model} baseUrl=${this.baseUrl}`);
            try {
                const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: AbortSignal.timeout(DEFAULT_OLLAMA_TIMEOUT_MS),
                    body: JSON.stringify({
                        model: this.model,
                        prompt,
                        stream: false,
                    }),
                });

                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok || !isOllamaGenerateResponse(payload)) {
                    throw new Error(`Ollama completion failed with status ${response.status}`);
                }
                const text = payload.response?.trim();
                if (!text) {
                    throw new Error("Ollama returned empty completion");
                }
                const usage = readOllamaUsage(payload);
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
                    provider: "ollama",
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
                    provider: "ollama",
                    model: this.model,
                    usage: null,
                    requestStatus: "error",
                    errorMessage: toLlmErrorMessage(error),
                });
                throw error;
            }
        });
}
