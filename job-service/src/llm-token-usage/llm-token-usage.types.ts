export type LlmProvider = "gemini" | "openai" | "custom" | "ollama";

export type LlmTokenStatus = "known" | "unknown";

export type LlmTokenUsageCounts = {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
};

export type LlmTokenUsageRecordInput = {
    readonly sourceService: string;
    readonly operation: string;
    readonly provider: LlmProvider;
    readonly model: string;
    readonly usage: LlmTokenUsageCounts | null;
};

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

export type LlmTokenUsageRecorder = {
    readonly record: (input: LlmTokenUsageRecordInput) => Promise<void>;
};
