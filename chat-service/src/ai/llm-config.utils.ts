import { DEFAULT_DIFY_API_BASE_URL, DEFAULT_GEMINI_MODEL, DEFAULT_LITELLM_BASE_URL, DEFAULT_LITELLM_MODEL, DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, DEFAULT_OPENAI_MODEL } from "./llm-config.consts";
import type { LlmEnvInput, ResolvedLlmConfig } from "./llm-config.types";

export const resolveLlmConfig = (env: LlmEnvInput): ResolvedLlmConfig => {
    if (env.llmProvider === "litellm") {
        const endpointUrl = env.litellmBaseUrl?.trim() || DEFAULT_LITELLM_BASE_URL;
        const apiKey = env.litellmApiKey?.trim();
        if (!apiKey) {
            throw new Error("resolveLlmConfig: missing LITELLM_API_KEY for provider litellm");
        }
        const model = env.litellmModel?.trim() || env.llmModel?.trim() || DEFAULT_LITELLM_MODEL;
        return { provider: "litellm", endpointUrl, apiKey, model };
    }

    if (env.llmProvider === "dify") {
        const endpointUrl = env.difyApiBaseUrl?.trim() || DEFAULT_DIFY_API_BASE_URL;
        const apiKey = env.difyApiKey?.trim();
        if (!apiKey) {
            throw new Error("resolveLlmConfig: missing DIFY_API_KEY for provider dify");
        }
        return { provider: "dify", endpointUrl, apiKey };
    }

    if (env.llmProvider === "gemini") {
        const apiKey = env.geminiApiKey?.trim();
        if (!apiKey) {
            throw new Error("resolveLlmConfig: missing GEMINI_API_KEY for provider gemini");
        }
        const model = env.geminiModel?.trim() || DEFAULT_GEMINI_MODEL;
        return { provider: "gemini", apiKey, model };
    }

    if (env.llmProvider === "openai") {
        const apiKey = env.openaiApiKey?.trim();
        if (!apiKey) {
            throw new Error("resolveLlmConfig: missing OPENAI_API_KEY for provider openai");
        }
        const model =
            env.openaiModel?.trim() ||
            env.llmModel?.trim() ||
            DEFAULT_OPENAI_MODEL;
        return { provider: "openai", apiKey, model };
    }

    if (env.llmProvider === "ollama") {
        const endpointUrl = env.ollamaBaseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL;
        const model = env.ollamaModel?.trim() || env.llmModel?.trim() || DEFAULT_OLLAMA_MODEL;
        return { provider: "ollama", endpointUrl, model };
    }

    const endpointUrl = env.customLlmUrl?.trim();
    if (!endpointUrl) {
        throw new Error("resolveLlmConfig: missing CUSTOM_LLM_URL for provider custom");
    }

    return { provider: "custom", endpointUrl };
};
