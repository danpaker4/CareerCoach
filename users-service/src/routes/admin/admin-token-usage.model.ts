import { z } from "zod";

export const LlmProviderSchema = z.enum(["gemini", "openai", "custom", "ollama"]);
export const LlmTokenStatusSchema = z.enum(["known", "unknown"]);
export const LlmRequestStatusSchema = z.enum(["success", "error"]);

export type LlmProvider = z.infer<typeof LlmProviderSchema>;
export type LlmTokenStatus = z.infer<typeof LlmTokenStatusSchema>;
export type LlmRequestStatus = z.infer<typeof LlmRequestStatusSchema>;

export type LlmTokenUsageDocument = {
    readonly createdAt: Date;
    readonly sourceService: string;
    readonly operation: string;
    readonly userId?: string;
    readonly provider: LlmProvider;
    readonly model: string;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly tokenStatus: LlmTokenStatus;
    readonly requestStatus?: LlmRequestStatus;
    readonly errorCount?: number;
    readonly errorMessage?: string;
    readonly requestCount: 1;
};
