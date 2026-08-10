import type { LlmTokenUsageContext } from "../../ai/token-usage/token-usage.types";

export type TextCompletionContext = LlmTokenUsageContext & {
    readonly responseFormat?: "json" | "text";
};

export type TextCompletionPort = {
    readonly complete: (prompt: string, context?: TextCompletionContext) => Promise<string>;
};

export type LiteLlmChatResponse = {
    readonly model?: string;
    readonly choices?: readonly {
        readonly finish_reason?: string | null;
        readonly message?: { readonly content?: string | null };
    }[];
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
};
