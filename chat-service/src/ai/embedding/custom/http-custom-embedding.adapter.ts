import { withSpan } from "../../../observability/tracing";
import type { EmbeddingPort } from "../embedding.types";

type CustomEmbeddingPayload = {
    vector?: unknown;
    embedding?: unknown;
    values?: unknown;
};

const toVector = (payload: unknown): number[] => {
    if (typeof payload !== "object" || payload === null) {
        return [];
    }
    const body = payload as CustomEmbeddingPayload;
    const candidate = body.vector ?? body.embedding ?? body.values;
    return Array.isArray(candidate) ? candidate.filter((item): item is number => typeof item === "number") : [];
};

export class HttpCustomEmbeddingAdapter implements EmbeddingPort {
    constructor(private readonly endpointUrl: string) { }

    readonly embedText = async (text: string): Promise<number[]> => withSpan("llm.embedding", {
        "llm.provider": "custom",
        "llm.model": "custom",
        "llm.operation": "embedding",
    }, async (span) => {
        const response = await fetch(this.endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        const payload: unknown = await response.json().catch(() => null);
        span.setAttribute("http.response.status_code", response.status);

        if (!response.ok) {
            span.setAttribute("llm.request.status", "error");
            return [];
        }
        const vector = toVector(payload);
        span.setAttribute("llm.request.status", vector.length > 0 ? "success" : "error");
        return vector;
    });

    readonly embedJob = (jobText: string): Promise<number[]> => this.embedText(jobText);
    readonly embedCareerProfile = (profileText: string): Promise<number[]> => this.embedText(profileText);
    readonly embedCareerDirection = (directionText: string): Promise<number[]> => this.embedText(directionText);
}
