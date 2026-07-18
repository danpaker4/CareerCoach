import { z } from "zod";
import { optionalEmptyString } from "../env.utils";

export const litellmConfigEnvSchema = z.object({
    LITELLM_BASE_URL: z.string().url({ message: "LITELLM_BASE_URL must be a valid URL" }),
    LITELLM_API_KEY: z.preprocess(optionalEmptyString, z.string().min(1).optional()),
    LITELLM_MODEL: z.preprocess(optionalEmptyString, z.string().min(1).optional()),
});

export type LitellmConfigEnv = z.infer<typeof litellmConfigEnvSchema>;
