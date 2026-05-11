import type { LlmEnvInput, ResolvedLlmConfig } from "./llm-config.types";
import { resolveLlmConfig } from "./llm-config.utils";

const hasValue = (value: string | undefined): boolean => typeof value === "string" && value.trim().length > 0;

export const buildTextCompletionLlmChain = (env: LlmEnvInput): readonly ResolvedLlmConfig[] => {
    const chain: ResolvedLlmConfig[] = [];

    if (env.llmProvider === "ollama" || hasValue(env.ollamaBaseUrl)) {
        chain.push(resolveLlmConfig({ ...env, llmProvider: "ollama" }));
    }

    if (hasValue(env.geminiApiKey)) {
        chain.push(resolveLlmConfig({ ...env, llmProvider: "gemini" }));
    }

    if (hasValue(env.openaiApiKey)) {
        chain.push(resolveLlmConfig({ ...env, llmProvider: "openai" }));
    }

    if (hasValue(env.customLlmUrl)) {
        chain.push(resolveLlmConfig({ ...env, llmProvider: "custom" }));
    }

    return chain;
};
