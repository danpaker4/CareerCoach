import type { LlmTokenUsageCounts, LlmTokenUsageRecorder } from "./token-usage.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const readNumber = (record: Record<string, unknown>, key: string): number | null => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const readOllamaUsage = (payload: unknown): LlmTokenUsageCounts | null => {
    if (!isRecord(payload)) {
        return null;
    }

    const promptTokens = readNumber(payload, "prompt_eval_count");
    const completionTokens = readNumber(payload, "eval_count");
    if (promptTokens === null || completionTokens === null) {
        return null;
    }

    return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
    };
};

export const readOpenAiUsage = (payload: unknown): LlmTokenUsageCounts | null => {
    if (!isRecord(payload) || !isRecord(payload.usage)) {
        return null;
    }

    const promptTokens = readNumber(payload.usage, "prompt_tokens");
    const completionTokens = readNumber(payload.usage, "completion_tokens");
    const totalTokens = readNumber(payload.usage, "total_tokens");
    if (promptTokens === null || completionTokens === null || totalTokens === null) {
        return null;
    }

    return { promptTokens, completionTokens, totalTokens };
};

export const readGeminiUsage = (response: unknown): LlmTokenUsageCounts | null => {
    if (!isRecord(response) || !isRecord(response.usageMetadata)) {
        return null;
    }

    const promptTokens = readNumber(response.usageMetadata, "promptTokenCount");
    const completionTokens = readNumber(response.usageMetadata, "candidatesTokenCount");
    const totalTokens = readNumber(response.usageMetadata, "totalTokenCount");
    if (promptTokens === null || completionTokens === null || totalTokens === null) {
        return null;
    }

    return { promptTokens, completionTokens, totalTokens };
};

export const recordLlmTokenUsage = async (
    recorder: LlmTokenUsageRecorder | undefined,
    input: Parameters<LlmTokenUsageRecorder["record"]>[0]
): Promise<void> => {
    if (!recorder) {
        return;
    }

    try {
        await recorder.record(input);
    } catch (error) {
        console.warn("[LLM] Failed to record token usage", error);
    }
};
