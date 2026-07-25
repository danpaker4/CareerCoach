import { describe, expect, it } from "vitest";
import type { UserMatchingContext } from "../../../cache/user-embedding.cache";
import type { EnrichedJob } from "../../../poller/job-poller-api-stack/stages/enrich/types";
import {
    blendSearchAndProfileVectors,
    createRankingFingerprint,
    decodeJobsCursor,
    encodeJobsCursor,
    isProfileContextCompatible,
    toJobsPageResponse,
} from "../jobs.utils";

const PROFILE_CONTEXT: UserMatchingContext = {
    embedding: [1, 0],
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    model: "test-model",
    status: "ready",
};

const makeJob = (index: number): EnrichedJob => ({
    id: `job-${index}`,
    jobTitle: `Job ${index}`,
    url: `https://example.test/jobs/${index}`,
    company: "Example",
    seniority: "mid",
    description: "Example job",
    lon: null,
    lat: null,
    salary: 0,
    requirements: [],
    benefits: [],
    languages: [],
    frameworks: [],
    databases: [],
    platforms: [],
    tools: [],
    mustKnowSkills: [],
    niceToHaveSkills: [],
    searchableText: "Example job",
    searchEmbedding: [1, 0],
});

describe("job ranking utilities", () => {
    it("blends normalized search and profile vectors with query-first weighting", () => {
        const blended = blendSearchAndProfileVectors([1, 0], [0, 1]);

        expect(blended).toHaveLength(2);
        expect(blended[0]).toBeCloseTo(0.9191, 3);
        expect(blended[1]).toBeCloseTo(0.3939, 3);
    });

    it("round-trips a valid cursor and rejects malformed cursors", () => {
        const cursor = {
            offset: 50,
            asOf: "2026-01-01T00:00:00.000Z",
            rankingFingerprint: "a".repeat(64),
        };

        expect(decodeJobsCursor(encodeJobsCursor(cursor))).toEqual(cursor);
        expect(decodeJobsCursor("not-a-cursor")).toBeNull();
    });

    it("changes the fingerprint when the search changes", () => {
        const first = createRankingFingerprint("user-1", "react", PROFILE_CONTEXT, "profile_query", "test-model");
        const second = createRankingFingerprint("user-1", "node", PROFILE_CONTEXT, "profile_query", "test-model");

        expect(first).not.toEqual(second);
    });

    it("returns 50 jobs and a continuation cursor when a lookahead job exists", () => {
        const cursor = {
            offset: 0,
            asOf: "2026-01-01T00:00:00.000Z",
            rankingFingerprint: "a".repeat(64),
        };
        const result = toJobsPageResponse(
            Array.from({ length: 51 }, (_, index) => makeJob(index)),
            PROFILE_CONTEXT,
            "profile",
            cursor,
        );

        expect(result.jobs).toHaveLength(50);
        expect(result.pagination.hasMore).toBe(true);
        expect(result.pagination.nextCursor).not.toBeNull();
        expect(decodeJobsCursor(result.pagination.nextCursor ?? "")?.offset).toBe(50);
    });

    it("requires ready profile vectors with the configured model and dimensions", () => {
        expect(isProfileContextCompatible(PROFILE_CONTEXT, "test-model", 2)).toBe(true);
        expect(isProfileContextCompatible({ ...PROFILE_CONTEXT, status: "pending" }, "test-model", 2)).toBe(false);
        expect(isProfileContextCompatible(PROFILE_CONTEXT, "different-model", 2)).toBe(false);
    });
});
