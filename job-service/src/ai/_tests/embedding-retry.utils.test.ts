import { describe, expect, it, vi } from "vitest";
import { runEmbeddingRequestWithRetry } from "../embedding-retry.utils";

describe("runEmbeddingRequestWithRetry", () => {
    it("returns successful request results without retrying", async () => {
        const request = vi.fn().mockResolvedValue([1, 2, 3]);

        await expect(runEmbeddingRequestWithRetry(request)).resolves.toEqual([1, 2, 3]);
        expect(request).toHaveBeenCalledTimes(1);
    });

    it("does not retry non-rate-limit errors", async () => {
        const error = Object.assign(new Error("invalid request"), { status: 400 });
        const request = vi.fn().mockRejectedValue(error);

        await expect(runEmbeddingRequestWithRetry(request)).rejects.toThrow("invalid request");
        expect(request).toHaveBeenCalledTimes(1);
    });

    it("honors a rate-limit retry response before trying again", async () => {
        vi.useFakeTimers();
        try {
            const error = Object.assign(new Error("rate limited"), {
                status: 429,
                errorDetails: [{ retryDelay: "0s" }],
            });
            const request = vi
                .fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce([1, 2, 3]);
            const resultPromise = runEmbeddingRequestWithRetry(request);

            await vi.runAllTimersAsync();

            await expect(resultPromise).resolves.toEqual([1, 2, 3]);
            expect(request).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});
