type LlmProviderId = "gemini" | "openai" | "custom" | "ollama";

export type ResolvedLlmConfig =
    | { readonly provider: "gemini"; readonly apiKey: string; readonly model: string }
    | { readonly provider: "openai"; readonly apiKey: string; readonly model: string }
    | { readonly provider: "custom"; readonly endpointUrl: string }
    | { readonly provider: "ollama"; readonly endpointUrl: string; readonly model: string };

export type LlmEnvInput = {
    readonly llmProvider: LlmProviderId;
    readonly geminiApiKey?: string;
    readonly geminiModel?: string;
    readonly openaiApiKey?: string;
    readonly llmModel?: string;
    readonly openaiModel?: string;
    readonly customLlmUrl?: string;
    readonly ollamaBaseUrl?: string;
    readonly ollamaModel?: string;
};
