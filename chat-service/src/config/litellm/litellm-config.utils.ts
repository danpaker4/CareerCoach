import type { ResolvedLlmConfig } from "../../litellm/config/litellm-config.types";
import { DEFAULT_LITELLM_MODEL } from "../../litellm/config/litellm-config.consts";
import { resolveLlmConfig } from "../../litellm/config/litellm-config.utils";
import type { LitellmConfigEnv } from "./litellm-config.schema";

export type { ResolvedLlmConfig };

export const createLitellmConfig = (env: LitellmConfigEnv): ResolvedLlmConfig =>
    resolveLlmConfig({
        liteLlmBaseUrl: env.LITELLM_BASE_URL,
        liteLlmApiKey: env.LITELLM_API_KEY,
        liteLlmModel: env.LITELLM_MODEL ?? DEFAULT_LITELLM_MODEL,
    });
