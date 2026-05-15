import { z } from "zod";

export const LlmProviderSchema = z.enum(["gemini", "openai", "custom", "ollama"]);
export const LlmTokenStatusSchema = z.enum(["known", "unknown"]);

export type LlmProvider = z.infer<typeof LlmProviderSchema>;
export type LlmTokenStatus = z.infer<typeof LlmTokenStatusSchema>;

export type LlmTokenUsageDocument = {
    readonly createdAt: Date;
    readonly sourceService: string;
    readonly operation: string;
    readonly provider: LlmProvider;
    readonly model: string;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly tokenStatus: LlmTokenStatus;
    readonly requestCount: 1;
};
