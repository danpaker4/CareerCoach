import type { TextCompletionPort } from "../../ports/text-completion.types";
import { OPENAI_CHAT_COMPLETIONS_URL } from "./openai-text-completion.consts";
import { formatOpenAiErrorMessage, isOpenAiChatResponse } from "./openai-text-completion.utils";

export class OpenAiTextCompletionAdapter implements TextCompletionPort {
    constructor(
        private readonly apiKey: string,
        private readonly model: string
    ) { }

    readonly complete = async (prompt: string): Promise<string> => {
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

        return text;
    };
}
