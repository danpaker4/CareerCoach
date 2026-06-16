import { z } from "zod";
import type { ServerConfig } from "./server.types";
import { resolveLlmConfig } from "./ai/llm-config.utils";
import { buildTextCompletionLlmChain } from "./ai/llm-text-completion-chain.utils";

const envString = (name: string) => z.string().min(1, `${name} is required`);

const optionalEmptyString = (value: unknown): unknown =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value;

const LlmProviderSchema = z.enum(["gemini", "openai", "custom", "ollama"]);

const EnvSchema = z
    .object({
        PORT: z.coerce.number().int().positive().default(3005),
        HOST: envString("HOST"),
        MONGO_CONNECTION_STRING: envString("MONGO_CONNECTION_STRING"),
        MONGO_KEY_PATH: z.string().optional(),
        USERS_SERVICE_BASE_URL: envString("USERS_SERVICE_BASE_URL"),
        JOB_SERVICE_BASE_URL: envString("JOB_SERVICE_BASE_URL"),
        CHAT_SERVICE_BASE_URL: envString("CHAT_SERVICE_BASE_URL"),
        INTERNAL_SERVICE_API_KEY: z.string().default("local-dev-internal-service-key"),
        LLM_PROVIDER: LlmProviderSchema.default("ollama"),
        GEMINI_API_KEY: z.preprocess(optionalEmptyString, z.string().optional()),
        GEMINI_MODEL: z.preprocess(optionalEmptyString, z.string().optional()),
        LLM_MODEL: z.preprocess(optionalEmptyString, z.string().optional()),
        OPENAI_API_KEY: z.preprocess(optionalEmptyString, z.string().optional()),
        OPENAI_MODEL: z.preprocess(optionalEmptyString, z.string().optional()),
        CUSTOM_LLM_URL: z.preprocess(optionalEmptyString, z.string().url().optional()),
        OLLAMA_BASE_URL: z.preprocess(optionalEmptyString, z.string().url().optional()),
        OLLAMA_MODEL: z.preprocess(optionalEmptyString, z.string().optional()),
        EMBEDDING_MODEL: z.preprocess(optionalEmptyString, z.string().optional()),
        CUSTOM_EMBEDDING_URL: z.preprocess(optionalEmptyString, z.string().url().optional()),
        CAREER_DIRECTION_VECTOR_INDEX_NAME: z.string().default("career_direction_vector_index"),
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
        roadmapConfig: {
            usersServiceBaseUrl: parsed.USERS_SERVICE_BASE_URL,
            jobServiceBaseUrl: parsed.JOB_SERVICE_BASE_URL,
            chatServiceBaseUrl: parsed.CHAT_SERVICE_BASE_URL,
            internalServiceApiKey: parsed.INTERNAL_SERVICE_API_KEY,
            llm,
            llmTextCompletionChain,
            embeddingModel: parsed.EMBEDDING_MODEL,
            customEmbeddingUrl: parsed.CUSTOM_EMBEDDING_URL,
            careerDirectionVectorIndexName: parsed.CAREER_DIRECTION_VECTOR_INDEX_NAME,
        },
    };
};
