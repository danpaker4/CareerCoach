import { GoogleGenerativeAI } from "@google/generative-ai";
import { withSpan } from "../../../observability/tracing";
import type { EmbeddingPort } from "../../ports/embedding.types";

export class GeminiEmbeddingAdapter implements EmbeddingPort {
    private readonly model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
    private readonly modelName: string;

    constructor(apiKey: string, modelName: string) {
        const client = new GoogleGenerativeAI(apiKey);
        this.modelName = modelName;
        this.model = client.getGenerativeModel({ model: modelName });
    }

    readonly embedText = async (text: string): Promise<number[]> => withSpan("llm.embedding", {
        "llm.provider": "gemini",
        "llm.model": this.modelName,
        "llm.operation": "embedding",
    }, async (span) => {
        const response = await this.model.embedContent(text);
        const values = response.embedding?.values;
        const vector = Array.isArray(values) ? values : [];
        span.setAttribute("llm.request.status", vector.length > 0 ? "success" : "error");
        return vector;
    });

    readonly embedJob = (jobText: string): Promise<number[]> => this.embedText(jobText);
    readonly embedCareerProfile = (profileText: string): Promise<number[]> => this.embedText(profileText);
    readonly embedCareerDirection = (directionText: string): Promise<number[]> => this.embedText(directionText);
}
