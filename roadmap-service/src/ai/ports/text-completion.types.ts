import type { LlmTokenUsageContext } from "../token-usage.types";

export type TextCompletionPort = {
    readonly complete: (prompt: string, context?: LlmTokenUsageContext) => Promise<string>;
};
