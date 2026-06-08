import type { ResolvedLlmConfig } from "./ai/llm-config.types";

export interface ServerConfig {
    port: number;
    host: string;
    mongoConfig: {
        mongoConnectionString: string;
        mongoKeyPath?: string;
    };
    chatConfig: {
        usersServiceBaseUrl: string;
        jobServiceBaseUrl: string;
        llm: ResolvedLlmConfig;
        llmTextCompletionChain: readonly ResolvedLlmConfig[];
        embeddingModel?: string;
        customEmbeddingUrl?: string;
        careerProfileVectorIndexName: string;
        careerDirectionVectorIndexName: string;
    };
    queueConfig: {
        rabbitMqUrl: string;
        requestQueueName: string;
        eventsExchangeName: string;
    };
}
