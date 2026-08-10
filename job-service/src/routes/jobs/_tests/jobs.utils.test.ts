import { describe, expect, it } from "vitest";
import type { UserMatchingContext } from "../../../cache/user-embedding.cache";
import type { EnrichedJob } from "../../../poller/job-poller-api-stack/stages/enrich/types";
import {
    computeLexicalMatchPct,
    createRankingFingerprint,
    decodeJobsCursor,
    encodeJobsCursor,
    filterRankedJobsByMinMatchFit,
    isProfileContextCompatible,
    rankJobsByQueryRelevance,
    shouldApplyMinMatchFitFilter,
    sliceJobsPageWindow,
    toJobsPageResponse,
} from "../jobs.utils";

const PROFILE_CONTEXT: UserMatchingContext = {
    embedding: [1, 0],
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    model: "test-model",
    status: "ready",
};

const makeJob = (index: number, overrides: Partial<EnrichedJob> = {}): EnrichedJob => ({
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
    ...overrides,
});

describe("job ranking utilities", () => {
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
            PROFILE_CONTEXT.embedding,
            "profile",
            cursor,
        );

        expect(result.jobs).toHaveLength(50);
        expect(result.pagination.hasMore).toBe(true);
        expect(result.pagination.nextCursor).not.toBeNull();
        expect(decodeJobsCursor(result.pagination.nextCursor ?? "")?.offset).toBe(50);
    });

    it("applies the match filter only when a search term is present", () => {
        expect(shouldApplyMinMatchFitFilter(PROFILE_CONTEXT.embedding, "profile", "")).toBe(false);
        expect(shouldApplyMinMatchFitFilter(PROFILE_CONTEXT.embedding, "profile_query", "react")).toBe(true);
        expect(shouldApplyMinMatchFitFilter(null, "profile_query", "react")).toBe(false);
        expect(shouldApplyMinMatchFitFilter([1, 0], "query", "rust")).toBe(true);
    });

    it("filters ranked jobs below the minimum match fit percentage", () => {
        const high = makeJob(1, {
            jobTitle: "Rust Developer",
            description: "Build services in Rust",
            searchEmbedding: [1, 0],
        });
        const low = makeJob(2, {
            jobTitle: "Cyber Threat Remediation Analyst",
            description: "Security incident response",
            searchEmbedding: [0, 1],
        });

        const filtered = filterRankedJobsByMinMatchFit([high, low], [1, 0], "rust developer");

        expect(filtered.map((job) => job.id)).toEqual(["job-1"]);
    });

    it("scores exact title phrase matches higher than unrelated titles", () => {
        const rustJob = makeJob(1, {
            jobTitle: "Rust Developer",
            description: "Build systems in Rust",
            searchEmbedding: [0.6, 0.8],
        });
        const cyberJob = makeJob(2, {
            jobTitle: "Cyber Threat Remediation Analyst",
            description: "Respond to security incidents",
            searchEmbedding: [0.55, 0.84],
        });

        expect(computeLexicalMatchPct(rustJob, "rust developer")).toBe(100);
        expect(computeLexicalMatchPct(cyberJob, "rust developer")).toBe(0);

        const ranked = rankJobsByQueryRelevance([cyberJob, rustJob], [0.7, 0.7], "rust developer");
        expect(ranked.map((job) => job.id)).toEqual(["job-1", "job-2"]);

        const page = toJobsPageResponse(
            ranked,
            [0.7, 0.7],
            "query",
            { offset: 0, asOf: "2026-01-01T00:00:00.000Z", rankingFingerprint: "a".repeat(64) },
            "rust developer",
        );
        expect(page.jobs[0]?.matchPct ?? 0).toBeGreaterThan(page.jobs[1]?.matchPct ?? 0);
    });

    it("slices a pagination window with lookahead", () => {
        const jobs = Array.from({ length: 5 }, (_, index) => makeJob(index));
        expect(sliceJobsPageWindow(jobs, 0)).toHaveLength(Math.min(5, 51));
        expect(sliceJobsPageWindow(jobs, 2).map((job) => job.id)).toEqual(["job-2", "job-3", "job-4"]);
    });

    it("requires ready profile vectors with the configured model and dimensions", () => {
        expect(isProfileContextCompatible(PROFILE_CONTEXT, "test-model", 2)).toBe(true);
        expect(isProfileContextCompatible({ ...PROFILE_CONTEXT, status: "pending" }, "test-model", 2)).toBe(false);
        expect(isProfileContextCompatible(PROFILE_CONTEXT, "different-model", 2)).toBe(false);
    });
});
