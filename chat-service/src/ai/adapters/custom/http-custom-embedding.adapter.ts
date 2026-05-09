import type { EmbeddingPort } from "../../ports/embedding.types";

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

    readonly embedText = async (text: string): Promise<number[]> => {
        const response = await fetch(this.endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
            return [];
        }
        return toVector(payload);
    };

    readonly embedJob = (jobText: string): Promise<number[]> => this.embedText(jobText);
    readonly embedUserMemory = (memoryText: string): Promise<number[]> => this.embedText(memoryText);
    readonly embedCareerProfile = (profileText: string): Promise<number[]> => this.embedText(profileText);
    readonly embedCareerDirection = (directionText: string): Promise<number[]> => this.embedText(directionText);
}
