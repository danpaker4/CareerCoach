import type { TextCompletionPort } from "./ports/text-completion.types";
import type { ResolvedLlmConfig } from "./llm-config.types";
import type { LlmTokenUsageRecorder } from "./token-usage.types";
import { GeminiTextCompletionAdapter } from "./adapters/gemini/gemini-text-completion.adapter";
import { OpenAiTextCompletionAdapter } from "./adapters/openai/openai-text-completion.adapter";
import { HttpCustomTextCompletionAdapter } from "./adapters/custom/http-custom-text-completion.adapter";
import { HttpOllamaTextCompletionAdapter } from "./adapters/custom/http-ollama-text-completion.adapter";
import { HttpLiteLlmTextCompletionAdapter } from "./adapters/litellm/http-litellm-text-completion.adapter";
import { HttpDifyTextCompletionAdapter } from "./adapters/dify/http-dify-text-completion.adapter";
import { FallbackTextCompletionAdapter } from "./adapters/custom/fallback-text-completion.adapter";
import { LangfuseTracedTextCompletionAdapter } from "./adapters/langfuse-traced-text-completion.adapter";

const resolveModelName = (llm: ResolvedLlmConfig): string => {
    if (llm.provider === "custom" || llm.provider === "dify") {
        return llm.provider;
    }
    return llm.model;
};

const createSingleTextCompletionPort = (llm: ResolvedLlmConfig, tokenUsageRecorder?: LlmTokenUsageRecorder): TextCompletionPort => {
    const adapter = ((): TextCompletionPort => {
        if (llm.provider === "litellm") {
            return new HttpLiteLlmTextCompletionAdapter(llm.endpointUrl, llm.apiKey, llm.model, tokenUsageRecorder);
        }

        if (llm.provider === "dify") {
            return new HttpDifyTextCompletionAdapter(llm.endpointUrl, llm.apiKey, tokenUsageRecorder);
        }

        if (llm.provider === "gemini") {
            return new GeminiTextCompletionAdapter(llm.apiKey, llm.model, tokenUsageRecorder);
        }

        if (llm.provider === "openai") {
            return new OpenAiTextCompletionAdapter(llm.apiKey, llm.model, tokenUsageRecorder);
        }

        if (llm.provider === "ollama") {
            return new HttpOllamaTextCompletionAdapter(llm.endpointUrl, llm.model, tokenUsageRecorder);
        }

        return new HttpCustomTextCompletionAdapter(llm.endpointUrl, tokenUsageRecorder);
    })();

    return new LangfuseTracedTextCompletionAdapter({
        inner: adapter,
        provider: llm.provider,
        model: resolveModelName(llm),
    });
};

export const createTextCompletionPortFromChain = (
    chain: readonly ResolvedLlmConfig[],
    tokenUsageRecorder?: LlmTokenUsageRecorder
): TextCompletionPort => {
    if (chain.length === 0) {
        throw new Error("createTextCompletionPortFromChain requires at least one provider");
    }

    if (chain.length === 1) {
        return createSingleTextCompletionPort(chain[0], tokenUsageRecorder);
    }

    return new FallbackTextCompletionAdapter(
        chain.map((providerConfig) => ({
            provider: providerConfig.provider,
            adapter: createSingleTextCompletionPort(providerConfig, tokenUsageRecorder),
        }))
    );
};
