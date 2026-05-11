import { z } from "zod";
import type { ServerConfig } from "./server.types";
import { resolveLlmConfig } from "./ai/llm-config.utils";
import { buildTextCompletionLlmChain } from "./ai/llm-text-completion-chain.utils";

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
        const chain = buildTextCompletionLlmChain({
            llmProvider: data.LLM_PROVIDER,
            geminiApiKey: data.GEMINI_API_KEY,
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
        chatConfig: {
            usersServiceBaseUrl: parsed.USERS_SERVICE_BASE_URL,
            jobServiceBaseUrl: parsed.JOB_SERVICE_BASE_URL,
            llm,
            llmTextCompletionChain,
            embeddingModel: parsed.EMBEDDING_MODEL,
            customEmbeddingUrl: parsed.CUSTOM_EMBEDDING_URL,
            conversationMemoryVectorIndexName: parsed.CONVERSATION_MEMORY_VECTOR_INDEX_NAME,
            careerProfileVectorIndexName: parsed.CAREER_PROFILE_VECTOR_INDEX_NAME,
            careerDirectionVectorIndexName: parsed.CAREER_DIRECTION_VECTOR_INDEX_NAME,
        },
    };
};
