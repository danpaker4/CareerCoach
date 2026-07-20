import { FallbackEmbeddingAdapter } from "./fallback/fallback-embedding.adapter";
import { HttpCustomEmbeddingAdapter } from "./custom/http-custom-embedding.adapter";
import type { EmbeddingPort } from "./embedding.types";

export const createEmbeddingPort = (customEmbeddingUrl?: string): EmbeddingPort => {
    if (customEmbeddingUrl?.trim()) {
        return new HttpCustomEmbeddingAdapter(customEmbeddingUrl.trim());
    }
    return new FallbackEmbeddingAdapter();
};
