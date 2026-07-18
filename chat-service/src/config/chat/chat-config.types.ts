import type { ResolvedLlmConfig } from "../../litellm/config/litellm-config.types";

export type ChatConfig = {
    readonly usersServiceBaseUrl: string;
    readonly jobServiceBaseUrl: string;
    readonly roadmapServiceBaseUrl: string;
    readonly llm: ResolvedLlmConfig;
    readonly customEmbeddingUrl?: string;
    readonly careerDirectionVectorIndexName: string;
    readonly internalServiceApiKey?: string;
};
