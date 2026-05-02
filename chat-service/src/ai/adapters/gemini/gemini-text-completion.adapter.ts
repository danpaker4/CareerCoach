import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TextCompletionPort } from "../../ports/text-completion.types";

export class GeminiTextCompletionAdapter implements TextCompletionPort {
    private readonly model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

    constructor(apiKey: string, modelName: string) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: modelName });
    }

    readonly complete = async (prompt: string): Promise<string> => {
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    };
}
