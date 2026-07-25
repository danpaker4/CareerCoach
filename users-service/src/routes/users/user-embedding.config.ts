import { z } from "zod";
import {
    DEFAULT_PROFILE_EMBEDDING_DIMENSIONS,
    DEFAULT_PROFILE_EMBEDDING_MODEL,
} from "./user-embedding.consts";

const ProfileEmbeddingEnvSchema = z.object({
    GEMINI_API_KEY: z.string().min(1).optional(),
    PROFILE_EMBEDDING_MODEL: z.string().min(1).default(DEFAULT_PROFILE_EMBEDDING_MODEL),
    PROFILE_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(DEFAULT_PROFILE_EMBEDDING_DIMENSIONS),
});

export const getProfileEmbeddingConfig = () => ProfileEmbeddingEnvSchema.parse(process.env);
