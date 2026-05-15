import type { TextCompletionPort } from "../../ports/text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../token-usage.types";
import { readOllamaUsage, recordLlmTokenUsage } from "../../token-usage.utils";

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

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> => {
        console.info(`[LLM] Sending request provider=ollama model=${this.model} baseUrl=${this.baseUrl}`);
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        await recordLlmTokenUsage(this.tokenUsageRecorder, {
            sourceService: "chat-service",
            operation: context?.operation ?? "chat.text_completion",
            provider: "ollama",
            model: this.model,
            usage: readOllamaUsage(payload),
        });
        return text;
    };
}
