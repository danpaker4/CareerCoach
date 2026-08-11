import { z } from "zod";
import { envString, optionalEmptyString } from "../env.utils";
import { DEFAULT_BENCHMARK_MODELS } from "./chat-config.consts";

export const chatConfigEnvSchema = z.object({
    USERS_SERVICE_BASE_URL: envString("USERS_SERVICE_BASE_URL"),
    JOB_SERVICE_BASE_URL: envString("JOB_SERVICE_BASE_URL"),
    ROADMAP_SERVICE_BASE_URL: envString("ROADMAP_SERVICE_BASE_URL"),
    CUSTOM_EMBEDDING_URL: z.preprocess(optionalEmptyString, z.string().url().optional()),
    CAREER_DIRECTION_VECTOR_INDEX_NAME: z.string().default("career_direction_vector_index"),
    INTERNAL_SERVICE_API_KEY: z.string().default("local-dev-internal-service-key"),
    BENCHMARK_OLLAMA_MODEL: z.preprocess(
        optionalEmptyString,
        z.string().min(1).default(DEFAULT_BENCHMARK_MODELS.ollamaLlama)
    ),
    BENCHMARK_GEMINI_MODEL: z.preprocess(
        optionalEmptyString,
        z.string().min(1).default(DEFAULT_BENCHMARK_MODELS.gemini)
    ),
});

export type ChatConfigEnv = z.infer<typeof chatConfigEnvSchema>;
