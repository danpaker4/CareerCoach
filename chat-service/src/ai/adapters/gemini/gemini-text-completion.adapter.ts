import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TextCompletionPort } from "../../ports/text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../token-usage.types";
import { readGeminiUsage, recordLlmTokenUsage, toLlmErrorMessage } from "../../token-usage.utils";

export class GeminiTextCompletionAdapter implements TextCompletionPort {
    private readonly model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
    private readonly modelName: string;

    constructor(
        apiKey: string,
        modelName: string,
        private readonly tokenUsageRecorder?: LlmTokenUsageRecorder
    ) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.modelName = modelName;
        this.model = genAI.getGenerativeModel({ model: modelName });
    }

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> => {
        console.info(`[LLM] Sending request provider=gemini model=${this.modelName}`);
        try {
            const result = await this.model.generateContent(prompt);
            const text = result.response.text();
            await recordLlmTokenUsage(this.tokenUsageRecorder, {
                sourceService: "chat-service",
                operation: context?.operation ?? "chat.text_completion",
                userId: context?.userId,
                provider: "gemini",
                model: this.modelName,
                usage: readGeminiUsage(result.response),
                requestStatus: "success",
            });
            return text;
        } catch (error: unknown) {
            await recordLlmTokenUsage(this.tokenUsageRecorder, {
                sourceService: "chat-service",
                operation: context?.operation ?? "chat.text_completion",
                userId: context?.userId,
                provider: "gemini",
                model: this.modelName,
                usage: null,
                requestStatus: "error",
                errorMessage: toLlmErrorMessage(error),
            });
            throw error;
        }
    };
}
