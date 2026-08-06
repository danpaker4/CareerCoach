export type ResolvedLlmConfig = {
    readonly provider: "litellm";
    readonly endpointUrl: string;
    readonly apiKey?: string;
    readonly model: string;
};

export type LiteLlmEnvInput = {
    readonly liteLlmBaseUrl?: string;
    readonly liteLlmApiKey?: string;
    readonly liteLlmModel?: string;
};
