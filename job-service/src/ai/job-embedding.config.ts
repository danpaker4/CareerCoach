import { z } from "zod";

const DEFAULT_JOB_EMBEDDING_MODEL = "gemini-embedding-001";
const DEFAULT_JOB_EMBEDDING_DIMENSIONS = 3_072;
const DEFAULT_JOB_VECTOR_INDEX_NAME = "jobs_search_embedding_vector_index";
const DEFAULT_JOB_VECTOR_INDEX_READY_TIMEOUT_MS = 120_000;

const emptyToUndefined = (value: unknown): unknown =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value;

const optionalNonEmptyString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const JobEmbeddingEnvSchema = z.object({
    GEMINI_API_KEY: optionalNonEmptyString,
    JOB_EMBEDDING_MODEL: z.string().min(1).default(DEFAULT_JOB_EMBEDDING_MODEL),
    JOB_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(DEFAULT_JOB_EMBEDDING_DIMENSIONS),
    JOB_VECTOR_INDEX_NAME: z.string().min(1).default(DEFAULT_JOB_VECTOR_INDEX_NAME),
    JOB_VECTOR_INDEX_READY_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(DEFAULT_JOB_VECTOR_INDEX_READY_TIMEOUT_MS),
    JOBS_VECTOR_SEARCH_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    USERS_SERVICE_BASE_URL: z.string().url().default("http://127.0.0.1:3001"),
    INTERNAL_SERVICE_API_KEY: optionalNonEmptyString,
}).superRefine((config, context) => {
    if (!config.JOBS_VECTOR_SEARCH_ENABLED) return;
    if (!config.GEMINI_API_KEY) {
        context.addIssue({
            code: "custom",
            path: ["GEMINI_API_KEY"],
            message: "GEMINI_API_KEY is required when vector search is enabled",
        });
    }
    if (!config.INTERNAL_SERVICE_API_KEY) {
        context.addIssue({
            code: "custom",
            path: ["INTERNAL_SERVICE_API_KEY"],
            message: "INTERNAL_SERVICE_API_KEY is required when vector search is enabled",
        });
    }
});

export type JobEmbeddingConfig = z.infer<typeof JobEmbeddingEnvSchema>;

export const getJobEmbeddingConfig = () => JobEmbeddingEnvSchema.parse(process.env);
