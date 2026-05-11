import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EmbeddingPort } from "../../ports/embedding.types";

export class GeminiEmbeddingAdapter implements EmbeddingPort {
    private readonly model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

    constructor(apiKey: string, modelName: string) {
        const client = new GoogleGenerativeAI(apiKey);
        this.model = client.getGenerativeModel({ model: modelName });
    }

    readonly embedText = async (text: string): Promise<number[]> => {
        const response = await this.model.embedContent(text);
        const values = response.embedding?.values;
        return Array.isArray(values) ? values : [];
    };

    readonly embedJob = (jobText: string): Promise<number[]> => this.embedText(jobText);
    readonly embedUserMemory = (memoryText: string): Promise<number[]> => this.embedText(memoryText);
    readonly embedCareerProfile = (profileText: string): Promise<number[]> => this.embedText(profileText);
    readonly embedCareerDirection = (directionText: string): Promise<number[]> => this.embedText(directionText);
}
