import type { LlmEnvInput, ResolvedLlmConfig } from "./llm-config.types";
import { resolveLlmConfig } from "./llm-config.utils";

const hasValue = (value: string | undefined): boolean => typeof value === "string" && value.trim().length > 0;

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
