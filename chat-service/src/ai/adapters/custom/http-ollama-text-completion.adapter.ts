import type { TextCompletionPort } from "../../ports/text-completion.types";

type OllamaGenerateResponse = {
    response?: string;
};

const isOllamaGenerateResponse = (value: unknown): value is OllamaGenerateResponse =>
    typeof value === "object" && value !== null && "response" in value;

export class HttpOllamaTextCompletionAdapter implements TextCompletionPort {
    constructor(
        private readonly baseUrl: string,
        private readonly model: string
    ) { }

    readonly complete = async (prompt: string): Promise<string> => {
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
        return text;
    };
}
