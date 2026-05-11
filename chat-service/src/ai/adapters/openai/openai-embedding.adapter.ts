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

    readonly embedText = async (text: string): Promise<number[]> => {
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
        if (!response.ok || !isOpenAiEmbeddingResponse(payload)) {
            return [];
        }
        const embedding = payload.data?.[0]?.embedding;
        return Array.isArray(embedding) ? embedding : [];
    };

    readonly embedJob = (jobText: string): Promise<number[]> => this.embedText(jobText);
    readonly embedUserMemory = (memoryText: string): Promise<number[]> => this.embedText(memoryText);
    readonly embedCareerProfile = (profileText: string): Promise<number[]> => this.embedText(profileText);
    readonly embedCareerDirection = (directionText: string): Promise<number[]> => this.embedText(directionText);
}
