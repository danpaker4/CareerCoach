import type { LlmEnvInput, ResolvedLlmConfig } from "./llm-config.types";
import { resolveLlmConfig } from "./llm-config.utils";

const hasValue = (value: string | undefined): boolean => typeof value === "string" && value.trim().length > 0;

const DIRECT_ESCAPE_HATCH_PROVIDERS = new Set(["ollama", "gemini", "openai", "custom"]);

export const buildTextCompletionLlmChain = (env: LlmEnvInput): readonly ResolvedLlmConfig[] => {
    const chain: ResolvedLlmConfig[] = [];
    const configuredProviders = new Set<ResolvedLlmConfig["provider"]>();

    const addProvider = (config: ResolvedLlmConfig): void => {
        if (configuredProviders.has(config.provider)) {
            return;
        }
        configuredProviders.add(config.provider);
        chain.push(config);
    };

    // Gateway mode (default): Dify app layer + LiteLLM model gateway can both be in the chain.
    // Order: Dify first (when keyed), then LiteLLM as shared model path / fallback.
    if (!DIRECT_ESCAPE_HATCH_PROVIDERS.has(env.llmProvider)) {
        if (hasValue(env.difyApiKey)) {
            addProvider(resolveLlmConfig({ ...env, llmProvider: "dify" }));
        }

        if (hasValue(env.litellmApiKey)) {
            addProvider(resolveLlmConfig({ ...env, llmProvider: "litellm" }));
        }

        if (chain.length > 0) {
            return chain;
        }
    }

    if (env.llmProvider === "ollama" || hasValue(env.ollamaBaseUrl) || hasValue(env.ollamaModel)) {
        addProvider(resolveLlmConfig({ ...env, llmProvider: "ollama" }));
    }

    if (hasValue(env.geminiApiKey)) {
        addProvider(resolveLlmConfig({ ...env, llmProvider: "gemini" }));
    }

    if (hasValue(env.customLlmUrl)) {
        addProvider(resolveLlmConfig({ ...env, llmProvider: "custom" }));
    }

    return chain;
};
