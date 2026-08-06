import type { EmbeddingPort } from "../embedding.types";

const EMBEDDING_SIZE = 128;

const deterministicEmbedding = (text: string): number[] => {
    const vector = new Array<number>(EMBEDDING_SIZE).fill(0);
    const normalized = text.toLowerCase();
    for (const [index, char] of [...normalized].entries()) {
        const bucket = (char.charCodeAt(0) + index) % EMBEDDING_SIZE;
        vector[bucket] = vector[bucket] + 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) {
        return vector;
    }
    return vector.map((value) => value / norm);
};

export class FallbackEmbeddingAdapter implements EmbeddingPort {
    readonly embedText = async (text: string): Promise<number[]> => deterministicEmbedding(text);
    readonly embedJob = (jobText: string): Promise<number[]> => this.embedText(jobText);
    readonly embedCareerProfile = (profileText: string): Promise<number[]> => this.embedText(profileText);
    readonly embedCareerDirection = (directionText: string): Promise<number[]> => this.embedText(directionText);
}
