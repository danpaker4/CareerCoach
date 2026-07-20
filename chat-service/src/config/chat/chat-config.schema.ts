import { z } from "zod";
import { envString, optionalEmptyString } from "../env.utils";

export const chatConfigEnvSchema = z.object({
    USERS_SERVICE_BASE_URL: envString("USERS_SERVICE_BASE_URL"),
    JOB_SERVICE_BASE_URL: envString("JOB_SERVICE_BASE_URL"),
    ROADMAP_SERVICE_BASE_URL: envString("ROADMAP_SERVICE_BASE_URL"),
    CUSTOM_EMBEDDING_URL: z.preprocess(optionalEmptyString, z.string().url().optional()),
    CAREER_DIRECTION_VECTOR_INDEX_NAME: z.string().default("career_direction_vector_index"),
    INTERNAL_SERVICE_API_KEY: z.string().default("local-dev-internal-service-key"),
});

export type ChatConfigEnv = z.infer<typeof chatConfigEnvSchema>;
