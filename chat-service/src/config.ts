import { z } from "zod";
import type { ServerConfig } from "./server.types";
import { resolveLlmConfig } from "./ai/llm-config.utils";

const envString = (name: string) => z.string().min(1, `${name} is required`);

const LlmProviderSchema = z.enum(["gemini", "openai", "custom", "ollama"]);

const EnvSchema = z
    .object({
        PORT: z.coerce.number().int().positive().default(3002),
        HOST: envString("HOST"),
        MONGO_CONNECTION_STRING: envString("MONGO_CONNECTION_STRING"),
        MONGO_KEY_PATH: z.string().optional(),
        USERS_SERVICE_BASE_URL: envString("USERS_SERVICE_BASE_URL"),
        JOB_SERVICE_BASE_URL: envString("JOB_SERVICE_BASE_URL"),
        LLM_PROVIDER: LlmProviderSchema.default("gemini"),
        GEMINI_API_KEY: z.string().optional(),
        LLM_MODEL: z.string().optional(),
        OPENAI_API_KEY: z.string().optional(),
        OPENAI_MODEL: z.string().optional(),
        CUSTOM_LLM_URL: z.string().url().optional(),
        OLLAMA_BASE_URL: z.string().url().optional(),
        OLLAMA_MODEL: z.string().optional(),
        EMBEDDING_MODEL: z.string().optional(),
        CUSTOM_EMBEDDING_URL: z.string().url().optional(),
        CONVERSATION_MEMORY_VECTOR_INDEX_NAME: z.string().default("conversation_memory_vector_index"),
        CAREER_PROFILE_VECTOR_INDEX_NAME: z.string().default("career_profile_vector_index"),
        CAREER_DIRECTION_VECTOR_INDEX_NAME: z.string().default("career_direction_vector_index"),
    })
    .superRefine((data, ctx) => {
        if (data.LLM_PROVIDER === "gemini" && (!data.GEMINI_API_KEY || data.GEMINI_API_KEY.trim().length === 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "GEMINI_API_KEY is required when LLM_PROVIDER=gemini",
                path: ["GEMINI_API_KEY"],
            });
        }
        if (data.LLM_PROVIDER === "openai" && (!data.OPENAI_API_KEY || data.OPENAI_API_KEY.trim().length === 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "OPENAI_API_KEY is required when LLM_PROVIDER=openai",
                path: ["OPENAI_API_KEY"],
            });
        }
        if (data.LLM_PROVIDER === "custom" && (!data.CUSTOM_LLM_URL || data.CUSTOM_LLM_URL.trim().length === 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "CUSTOM_LLM_URL is required when LLM_PROVIDER=custom",
                path: ["CUSTOM_LLM_URL"],
            });
        }
        if (data.LLM_PROVIDER === "ollama" && (!data.OLLAMA_BASE_URL || data.OLLAMA_BASE_URL.trim().length === 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama",
                path: ["OLLAMA_BASE_URL"],
            });
        }
    });

export const createConfigFromEnv = (env: NodeJS.ProcessEnv): ServerConfig => {
    const parsed = EnvSchema.parse(env);
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
            llm: resolveLlmConfig({
                llmProvider: parsed.LLM_PROVIDER,
                geminiApiKey: parsed.GEMINI_API_KEY,
                openaiApiKey: parsed.OPENAI_API_KEY,
                llmModel: parsed.LLM_MODEL,
                openaiModel: parsed.OPENAI_MODEL,
                customLlmUrl: parsed.CUSTOM_LLM_URL,
                ollamaBaseUrl: parsed.OLLAMA_BASE_URL,
                ollamaModel: parsed.OLLAMA_MODEL,
            }),
            embeddingModel: parsed.EMBEDDING_MODEL,
            customEmbeddingUrl: parsed.CUSTOM_EMBEDDING_URL,
            conversationMemoryVectorIndexName: parsed.CONVERSATION_MEMORY_VECTOR_INDEX_NAME,
            careerProfileVectorIndexName: parsed.CAREER_PROFILE_VECTOR_INDEX_NAME,
            careerDirectionVectorIndexName: parsed.CAREER_DIRECTION_VECTOR_INDEX_NAME,
        },
    };
};
