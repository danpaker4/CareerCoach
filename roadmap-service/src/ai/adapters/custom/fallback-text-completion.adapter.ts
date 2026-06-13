import type { LlmTokenUsageContext } from "../../token-usage.types";
import type { TextCompletionPort } from "../../ports/text-completion.types";

type TextCompletionAttempt = {
    readonly provider: string;
    readonly adapter: TextCompletionPort;
};

export class FallbackTextCompletionAdapter implements TextCompletionPort {
    constructor(private readonly attempts: readonly TextCompletionAttempt[]) { }

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> => {
        const errors: string[] = [];

        for (const attempt of this.attempts) {
            try {
                return await attempt.adapter.complete(prompt, context);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unknown error";
                errors.push(`${attempt.provider}: ${message}`);
                console.warn(`[LLM] provider=${attempt.provider} failed, falling back to next provider`);
            }
        }

        throw new Error(`All LLM providers failed (${errors.join(" | ")})`);
    };
}
