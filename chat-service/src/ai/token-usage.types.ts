export type LlmProvider = "gemini" | "openai" | "custom" | "ollama" | "litellm" | "dify";

export type LlmTokenStatus = "known" | "unknown";

export type LlmRequestStatus = "success" | "error";

export type LlmTokenUsageContext = {
    readonly operation: string;
    readonly userId?: string;
};

export type LlmTokenUsageCounts = {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
};

export type LlmTokenUsageRecordInput = {
    readonly sourceService: string;
    readonly operation: string;
    readonly userId?: string;
    readonly provider: LlmProvider;
    readonly model: string;
    readonly usage: LlmTokenUsageCounts | null;
    readonly requestStatus?: LlmRequestStatus;
    readonly errorMessage?: string;
};

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

export type LlmTokenUsageRecorder = {
    readonly record: (input: LlmTokenUsageRecordInput) => Promise<void>;
};
