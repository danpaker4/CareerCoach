import { withSpan } from "../../../observability/tracing";
import type { EmbeddingPort } from "../../ports/embedding.types";

type OpenAiEmbeddingResponse = {
    data?: Array<{ embedding?: number[] }>;
};

const isOpenAiEmbeddingResponse = (value: unknown): value is OpenAiEmbeddingResponse =>
    typeof value === "object" && value !== null && "data" in value;

export class OpenAiEmbeddingAdapter implements EmbeddingPort {
    constructor(
        private readonly apiKey: string,
        private readonly model: string
    ) { }

    readonly embedText = async (text: string): Promise<number[]> => withSpan("llm.embedding", {
        "llm.provider": "openai",
        "llm.model": this.model,
        "llm.operation": "embedding",
    }, async (span) => {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: this.model,
                input: text,
            }),
        });
        const payload: unknown = await response.json().catch(() => null);
        span.setAttribute("http.response.status_code", response.status);

        if (!response.ok || !isOpenAiEmbeddingResponse(payload)) {
            span.setAttribute("llm.request.status", "error");
            return [];
        }
        const embedding = payload.data?.[0]?.embedding;
        const vector = Array.isArray(embedding) ? embedding : [];
        span.setAttribute("llm.request.status", vector.length > 0 ? "success" : "error");
        return vector;
    });

    readonly embedJob = (jobText: string): Promise<number[]> => this.embedText(jobText);
    readonly embedCareerProfile = (profileText: string): Promise<number[]> => this.embedText(profileText);
    readonly embedCareerDirection = (directionText: string): Promise<number[]> => this.embedText(directionText);
}
