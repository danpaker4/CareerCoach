import type { LlmTokenUsageContext } from "../../ai/token-usage/token-usage.types";

export type TextCompletionRequest = {
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly responseFormat: "json" | "text";
};

export type TextCompletionPort = {
    readonly complete: (request: TextCompletionRequest, context?: LlmTokenUsageContext) => Promise<string>;
};

export type LiteLlmChatResponse = {
    choices?: readonly { message?: { content?: string | null } }[];
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
};
