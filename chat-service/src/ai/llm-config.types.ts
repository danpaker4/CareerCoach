export type LlmProviderId = "gemini" | "openai" | "custom";

export type ResolvedLlmConfig =
    | { readonly provider: "gemini"; readonly apiKey: string; readonly model: string }
    | { readonly provider: "openai"; readonly apiKey: string; readonly model: string }
    | { readonly provider: "custom"; readonly endpointUrl: string };

export type LlmEnvInput = {
    readonly llmProvider: LlmProviderId;
    readonly geminiApiKey?: string;
    readonly openaiApiKey?: string;
    readonly llmModel?: string;
    readonly openaiModel?: string;
    readonly customLlmUrl?: string;
};
