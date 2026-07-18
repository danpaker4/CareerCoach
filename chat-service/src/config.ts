import { z } from "zod";
import type { ServerConfig } from "./server.types";
import { resolveLlmConfig } from "./ai/llm-config.utils";
import { buildTextCompletionLlmChain } from "./ai/llm-text-completion-chain.utils";

const envString = (name: string) => z.string().min(1, `${name} is required`);

const LlmProviderSchema = z.enum(["gemini", "openai", "custom", "ollama", "litellm", "dify"]);

const EnvSchema = z
    .object({
        PORT: z.coerce.number().int().positive().default(3002),
        HOST: envString("HOST"),
        MONGO_CONNECTION_STRING: envString("MONGO_CONNECTION_STRING"),
        MONGO_KEY_PATH: z.string().optional(),
        USERS_SERVICE_BASE_URL: envString("USERS_SERVICE_BASE_URL"),
        JOB_SERVICE_BASE_URL: envString("JOB_SERVICE_BASE_URL"),
        ROADMAP_SERVICE_BASE_URL: envString("ROADMAP_SERVICE_BASE_URL"),
        RABBITMQ_URL: envString("RABBITMQ_URL"),
        CHAT_REQUEST_QUEUE_NAME: z.string().min(1).default("chat.message.requests"),
        CHAT_EVENTS_EXCHANGE_NAME: z.string().min(1).default("chat.request.events"),
        LLM_PROVIDER: LlmProviderSchema.default("litellm"),
        GEMINI_API_KEY: z.string().optional(),
        GEMINI_MODEL: z.string().optional(),
        LLM_MODEL: z.string().optional(),
        OPENAI_API_KEY: z.string().optional(),
        OPENAI_MODEL: z.string().optional(),
        CUSTOM_LLM_URL: z.string().url().optional(),
        OLLAMA_BASE_URL: z.string().url().optional(),
        OLLAMA_MODEL: z.string().optional(),
        LITELLM_BASE_URL: z.string().url().optional(),
        LITELLM_API_KEY: z.string().optional(),
        LITELLM_MODEL: z.string().optional(),
        DIFY_API_BASE_URL: z.string().url().optional(),
        DIFY_API_KEY: z.string().optional(),
        EMBEDDING_MODEL: z.string().optional(),
        CUSTOM_EMBEDDING_URL: z.string().url().optional(),
        CAREER_PROFILE_VECTOR_INDEX_NAME: z.string().default("career_profile_vector_index"),
        CAREER_DIRECTION_VECTOR_INDEX_NAME: z.string().default("career_direction_vector_index"),
        INTERNAL_SERVICE_API_KEY: z.string().default("local-dev-internal-service-key"),
    })
    .superRefine((data, ctx) => {
        const chain = buildTextCompletionLlmChain({
            llmProvider: data.LLM_PROVIDER,
            geminiApiKey: data.GEMINI_API_KEY,
            geminiModel: data.GEMINI_MODEL,
            openaiApiKey: data.OPENAI_API_KEY,
            llmModel: data.LLM_MODEL,
            openaiModel: data.OPENAI_MODEL,
            customLlmUrl: data.CUSTOM_LLM_URL,
            ollamaBaseUrl: data.OLLAMA_BASE_URL,
            ollamaModel: data.OLLAMA_MODEL,
            litellmBaseUrl: data.LITELLM_BASE_URL,
            litellmApiKey: data.LITELLM_API_KEY,
            litellmModel: data.LITELLM_MODEL,
            difyApiBaseUrl: data.DIFY_API_BASE_URL,
            difyApiKey: data.DIFY_API_KEY,
        });
        if (chain.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "No usable LLM provider configured. Configure at least one provider for text completion fallback.",
                path: ["LLM_PROVIDER"],
            });
        }
    });

export const createConfigFromEnv = (env: NodeJS.ProcessEnv): ServerConfig => {
    const parsed = EnvSchema.parse(env);
    const llmTextCompletionChain = buildTextCompletionLlmChain({
        llmProvider: parsed.LLM_PROVIDER,
        geminiApiKey: parsed.GEMINI_API_KEY,
        geminiModel: parsed.GEMINI_MODEL,
        openaiApiKey: parsed.OPENAI_API_KEY,
        llmModel: parsed.LLM_MODEL,
        openaiModel: parsed.OPENAI_MODEL,
        customLlmUrl: parsed.CUSTOM_LLM_URL,
        ollamaBaseUrl: parsed.OLLAMA_BASE_URL,
        ollamaModel: parsed.OLLAMA_MODEL,
        litellmBaseUrl: parsed.LITELLM_BASE_URL,
        litellmApiKey: parsed.LITELLM_API_KEY,
        litellmModel: parsed.LITELLM_MODEL,
        difyApiBaseUrl: parsed.DIFY_API_BASE_URL,
        difyApiKey: parsed.DIFY_API_KEY,
    });
    const llm = (() => {
        try {
            return resolveLlmConfig({
                llmProvider: parsed.LLM_PROVIDER,
                geminiApiKey: parsed.GEMINI_API_KEY,
                geminiModel: parsed.GEMINI_MODEL,
                openaiApiKey: parsed.OPENAI_API_KEY,
                llmModel: parsed.LLM_MODEL,
                openaiModel: parsed.OPENAI_MODEL,
                customLlmUrl: parsed.CUSTOM_LLM_URL,
                ollamaBaseUrl: parsed.OLLAMA_BASE_URL,
                ollamaModel: parsed.OLLAMA_MODEL,
                litellmBaseUrl: parsed.LITELLM_BASE_URL,
                litellmApiKey: parsed.LITELLM_API_KEY,
                litellmModel: parsed.LITELLM_MODEL,
                difyApiBaseUrl: parsed.DIFY_API_BASE_URL,
                difyApiKey: parsed.DIFY_API_KEY,
            });
        } catch {
            return llmTextCompletionChain[0];
        }
    })();

    return {
        port: parsed.PORT,
        host: parsed.HOST,
        mongoConfig: {
            mongoConnectionString: parsed.MONGO_CONNECTION_STRING,
            mongoKeyPath: parsed.MONGO_KEY_PATH,
        },
        chatConfig: {
            usersServiceBaseUrl: parsed.USERS_SERVICE_BASE_URL,
            jobServiceBaseUrl: parsed.JOB_SERVICE_BASE_URL,
            roadmapServiceBaseUrl: parsed.ROADMAP_SERVICE_BASE_URL,
            llm,
            llmTextCompletionChain,
            embeddingModel: parsed.EMBEDDING_MODEL,
            customEmbeddingUrl: parsed.CUSTOM_EMBEDDING_URL,
            careerProfileVectorIndexName: parsed.CAREER_PROFILE_VECTOR_INDEX_NAME,
            careerDirectionVectorIndexName: parsed.CAREER_DIRECTION_VECTOR_INDEX_NAME,
            internalServiceApiKey: parsed.INTERNAL_SERVICE_API_KEY,
        },
        queueConfig: {
            rabbitMqUrl: parsed.RABBITMQ_URL,
            requestQueueName: parsed.CHAT_REQUEST_QUEUE_NAME,
            eventsExchangeName: parsed.CHAT_EVENTS_EXCHANGE_NAME,
        },
    };
};
