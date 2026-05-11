import type { TextCompletionPort } from "../../ports/text-completion.types";
import { readTextFromCustomLlmPayload } from "./http-custom-text-completion.utils";

export class HttpCustomTextCompletionAdapter implements TextCompletionPort {
    constructor(private readonly endpointUrl: string) { }

    readonly complete = async (prompt: string): Promise<string> => {
        console.info(`[LLM] Sending request provider=custom endpoint=${this.endpointUrl}`);
        const response = await fetch(this.endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`Custom LLM HTTP ${response.status}: ${JSON.stringify(payload)}`);
        }

        const text = readTextFromCustomLlmPayload(payload);
        if (!text) {
            throw new Error("Custom LLM response must include non-empty text, reply, or content string");
        }

        return text;
    };
}
