import type { LlmTokenUsageCounts } from "../../token-usage.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const readNumber = (record: Record<string, unknown>, key: string): number | null => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export type DifyChatMessageResponse = {
    readonly answer: string;
    readonly usage: LlmTokenUsageCounts | null;
};

export const readDifyChatMessageResponse = (payload: unknown): DifyChatMessageResponse | null => {
    if (!isRecord(payload) || typeof payload.answer !== "string" || payload.answer.trim().length === 0) {
        return null;
    }

    const metadata = isRecord(payload.metadata) ? payload.metadata : null;
    const usageRecord = metadata && isRecord(metadata.usage) ? metadata.usage : isRecord(payload.usage) ? payload.usage : null;
    if (!usageRecord) {
        return { answer: payload.answer, usage: null };
    }

    const promptTokens = readNumber(usageRecord, "prompt_tokens") ?? readNumber(usageRecord, "promptTokens");
    const completionTokens = readNumber(usageRecord, "completion_tokens") ?? readNumber(usageRecord, "completionTokens");
    const totalTokens = readNumber(usageRecord, "total_tokens") ?? readNumber(usageRecord, "totalTokens");
    if (promptTokens === null || completionTokens === null || totalTokens === null) {
        return { answer: payload.answer, usage: null };
    }

    return {
        answer: payload.answer,
        usage: { promptTokens, completionTokens, totalTokens },
    };
};

export const formatDifyErrorMessage = (payload: unknown, statusText: string): string => {
    if (isRecord(payload) && typeof payload.message === "string") {
        return payload.message;
    }
    if (isRecord(payload) && typeof payload.code === "string") {
        return payload.code;
    }
    return statusText;
};
