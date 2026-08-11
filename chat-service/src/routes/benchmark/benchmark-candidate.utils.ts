import type { ServerConfig } from "../../server.types";
import type { ResolvedLlmConfig } from "../../litellm/config/litellm-config.types";
import type { BenchmarkCandidate, BenchmarkCandidateId } from "./benchmark.types";

export const resolveCandidateConfig = (
    candidateId: BenchmarkCandidateId,
    chatConfig: ServerConfig["chatConfig"]
): ResolvedLlmConfig => {
    const model = candidateId === "ollama-llama"
        ? chatConfig.benchmarkModels.ollamaLlama
        : chatConfig.benchmarkModels.gemini;

    return {
        provider: "litellm",
        endpointUrl: chatConfig.llm.endpointUrl,
        model,
        ...(chatConfig.llm.apiKey ? { apiKey: chatConfig.llm.apiKey } : {}),
    };
};

export const toBenchmarkCandidate = (
    candidateId: BenchmarkCandidateId,
    chatConfig: ServerConfig["chatConfig"]
): BenchmarkCandidate => {
    const config = resolveCandidateConfig(candidateId, chatConfig);
    if (candidateId === "ollama-llama") {
        return {
            id: candidateId,
            label: "Llama via LiteLLM",
            provider: "litellm",
            model: config.model,
            available: true,
        };
    }

    return {
        id: candidateId,
        label: "Gemini via LiteLLM",
        provider: "litellm",
        model: config.model,
        available: true,
    };
};
