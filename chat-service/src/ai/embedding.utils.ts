import { FallbackEmbeddingAdapter } from "./adapters/custom/fallback-embedding.adapter";
import { HttpCustomEmbeddingAdapter } from "./adapters/custom/http-custom-embedding.adapter";
import { GeminiEmbeddingAdapter } from "./adapters/gemini/gemini-embedding.adapter";
import { OpenAiEmbeddingAdapter } from "./adapters/openai/openai-embedding.adapter";
import type { ResolvedLlmConfig } from "./llm-config.types";
import type { EmbeddingPort } from "./ports/embedding.types";

export const createEmbeddingPort = (llm: ResolvedLlmConfig, embeddingModel?: string, customEmbeddingUrl?: string): EmbeddingPort => {
    if (llm.provider === "gemini") {
        return new GeminiEmbeddingAdapter(llm.apiKey, embeddingModel?.trim() || "text-embedding-004");
    }
    if (llm.provider === "openai") {
        return new OpenAiEmbeddingAdapter(llm.apiKey, embeddingModel?.trim() || "text-embedding-3-small");
    }
    if (llm.provider === "ollama") {
        if (customEmbeddingUrl?.trim()) {
            return new HttpCustomEmbeddingAdapter(customEmbeddingUrl.trim(), embeddingModel?.trim() || undefined);
        }
        return new FallbackEmbeddingAdapter();
    }
    if (customEmbeddingUrl?.trim()) {
        return new HttpCustomEmbeddingAdapter(customEmbeddingUrl.trim(), embeddingModel?.trim() || undefined);
    }
    return new FallbackEmbeddingAdapter();
};
