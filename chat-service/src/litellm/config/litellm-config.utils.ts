import { DEFAULT_LITELLM_MODEL } from "./litellm-config.consts";
import type { LiteLlmEnvInput, ResolvedLlmConfig } from "./litellm-config.types";

export const resolveLlmConfig = (env: LiteLlmEnvInput): ResolvedLlmConfig => {
    const endpointUrl = env.liteLlmBaseUrl?.trim();
    if (!endpointUrl) {
        throw new Error("resolveLlmConfig: missing LITELLM_BASE_URL");
    }

    const model = env.liteLlmModel?.trim() || DEFAULT_LITELLM_MODEL;
    const apiKey = env.liteLlmApiKey?.trim();

    return {
        provider: "litellm",
        endpointUrl,
        model,
        ...(apiKey ? { apiKey } : {}),
    };
};
