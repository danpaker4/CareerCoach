import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUserMatchingContext } from "../user-profile.client";

describe("fetchUserMatchingContext", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses internal-service authentication and parses embedding metadata", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            profileEmbedding: [1, 0],
            profileEmbeddingUpdatedAt: "2026-01-01T00:00:00.000Z",
            profileEmbeddingModel: "test-model",
            profileEmbeddingStatus: "ready",
        }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchUserMatchingContext(
            "http://users.test",
            "user-1",
            "internal-secret",
        );

        expect(fetchMock).toHaveBeenCalledWith(
            "http://users.test/users/user-1/job-matching-context",
            {
                headers: {
                    "X-Internal-Service-Key": "internal-secret",
                    "X-Service-User-Id": "user-1",
                },
            },
        );
        expect(result).toEqual({
            embedding: [1, 0],
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            model: "test-model",
            status: "ready",
        });
    });
});
