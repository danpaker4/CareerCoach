import type { TextCompletionPort } from "./ports/text-completion.types";
import type { ResolvedLlmConfig } from "./llm-config.types";
import { GeminiTextCompletionAdapter } from "./adapters/gemini/gemini-text-completion.adapter";
import { OpenAiTextCompletionAdapter } from "./adapters/openai/openai-text-completion.adapter";
import { HttpCustomTextCompletionAdapter } from "./adapters/custom/http-custom-text-completion.adapter";
import { HttpOllamaTextCompletionAdapter } from "./adapters/custom/http-ollama-text-completion.adapter";
import { FallbackTextCompletionAdapter } from "./adapters/custom/fallback-text-completion.adapter";

const createSingleTextCompletionPort = (llm: ResolvedLlmConfig): TextCompletionPort => {
    if (llm.provider === "gemini") {
        return new GeminiTextCompletionAdapter(llm.apiKey, llm.model);
    }

    if (llm.provider === "openai") {
        return new OpenAiTextCompletionAdapter(llm.apiKey, llm.model);
    }

    if (llm.provider === "ollama") {
        return new HttpOllamaTextCompletionAdapter(llm.endpointUrl, llm.model);
    }

    return new HttpCustomTextCompletionAdapter(llm.endpointUrl);
};

export const createTextCompletionPort = (llm: ResolvedLlmConfig): TextCompletionPort => createSingleTextCompletionPort(llm);

export const createTextCompletionPortFromChain = (chain: readonly ResolvedLlmConfig[]): TextCompletionPort => {
    if (chain.length === 0) {
        throw new Error("createTextCompletionPortFromChain requires at least one provider");
    }

    if (chain.length === 1) {
        return createSingleTextCompletionPort(chain[0]);
    }

    return new FallbackTextCompletionAdapter(
        chain.map((providerConfig) => ({
            provider: providerConfig.provider,
            adapter: createSingleTextCompletionPort(providerConfig),
        }))
    );
};
