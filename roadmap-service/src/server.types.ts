import type { ResolvedLlmConfig } from "./ai/llm-config.types";

export type ServerConfig = {
    port: number;
    host: string;
    mongoConfig: {
        mongoConnectionString: string;
        mongoKeyPath?: string;
    };
    roadmapConfig: {
        usersServiceBaseUrl: string;
        jobServiceBaseUrl: string;
        chatServiceBaseUrl: string;
        internalServiceApiKey: string;
        llm: ResolvedLlmConfig;
        llmTextCompletionChain: readonly ResolvedLlmConfig[];
        embeddingModel?: string;
        customEmbeddingUrl?: string;
        careerDirectionVectorIndexName: string;
    };
};
