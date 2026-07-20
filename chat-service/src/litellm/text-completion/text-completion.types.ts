import type { LlmTokenUsageContext } from "../../ai/token-usage/token-usage.types";

export type TextCompletionPort = {
    readonly complete: (prompt: string, context?: LlmTokenUsageContext) => Promise<string>;
};

export type LiteLlmChatResponse = {
    choices?: readonly { message?: { content?: string | null } }[];
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
};
