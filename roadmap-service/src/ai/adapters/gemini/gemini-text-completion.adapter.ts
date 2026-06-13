import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TextCompletionPort } from "../../ports/text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../token-usage.types";
import { readGeminiUsage, recordLlmTokenUsage, toLlmErrorMessage } from "../../token-usage.utils";
import { withSpan } from "../../../observability/tracing";

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

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> =>
        await withSpan("llm.complete", {
            "llm.provider": "gemini",
            "llm.model": this.modelName,
            "llm.operation": context?.operation ?? "chat.text_completion",
            ...(context?.userId ? { "enduser.id": context.userId } : {}),
        }, async (span) => {
            console.info(`[LLM] Sending request provider=gemini model=${this.modelName}`);
            try {
                const result = await this.model.generateContent(prompt);
                const text = result.response.text();
                const usage = readGeminiUsage(result.response);
                span.setAttributes({
                    "llm.request.status": "success",
                    "llm.usage.prompt_tokens": usage?.promptTokens ?? 0,
                    "llm.usage.completion_tokens": usage?.completionTokens ?? 0,
                    "llm.usage.total_tokens": usage?.totalTokens ?? 0,
                });
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "roadmap-service",
                    operation: context?.operation ?? "chat.text_completion",
                    userId: context?.userId,
                    provider: "gemini",
                    model: this.modelName,
                    usage,
                    requestStatus: "success",
                });
                return text;
            } catch (error: unknown) {
                span.setAttribute("llm.request.status", "error");
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "roadmap-service",
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
        });
}
