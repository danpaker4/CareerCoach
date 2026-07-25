import {
    EMBEDDING_MAX_RETRIES,
    EMBEDDING_RETRY_DELAY_BUFFER_MS,
    EMBEDDING_RETRY_FALLBACK_DELAY_MS,
} from "./embedding-retry.consts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const getStatus = (error: unknown): number | null =>
    isRecord(error) && typeof error.status === "number" ? error.status : null;

const parseDurationMs = (duration: unknown): number | null => {
    if (typeof duration !== "string") return null;
    const match = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
    if (!match) return null;
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) ? Math.ceil(seconds * 1_000) : null;
};

const getRetryDelayMs = (error: unknown): number => {
    if (!isRecord(error) || !Array.isArray(error.errorDetails)) {
        return EMBEDDING_RETRY_FALLBACK_DELAY_MS;
    }
    const retryDelay = error.errorDetails
        .map((detail) => isRecord(detail) ? parseDurationMs(detail.retryDelay) : null)
        .find((delay): delay is number => delay !== null);
    return (retryDelay ?? EMBEDDING_RETRY_FALLBACK_DELAY_MS) + EMBEDDING_RETRY_DELAY_BUFFER_MS;
};

export const delay = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

export const runEmbeddingRequestWithRetry = async <T>(
    request: () => Promise<T>,
    attempt = 1,
): Promise<T> => {
    try {
        return await request();
    } catch (error) {
        if (getStatus(error) !== 429 || attempt >= EMBEDDING_MAX_RETRIES) {
            throw error;
        }
        await delay(getRetryDelayMs(error));
        return runEmbeddingRequestWithRetry(request, attempt + 1);
    }
};
