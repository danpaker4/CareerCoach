import type { LlmTokenUsageCounts, LlmTokenUsageRecorder } from "../token-usage.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const readNumber = (record: Record<string, unknown>, key: string): number | null => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
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

export const toLlmErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
