import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnrichedJob } from "../../../poller/job-poller-api-stack/stages/enrich/types";
import { JobsHandler } from "../jobs.handler";
import type { JobsPageQuery, JobsPageResponse } from "../jobs.types";

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
    searchEmbedding: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("JobsHandler pagination fallback", () => {
    beforeEach(() => {
        process.env.JOBS_VECTOR_SEARCH_ENABLED = "false";
    });

    it("returns a 50-job envelope and uses the cursor offset for the next page", async () => {
        const skip = vi.fn();
        const limit = vi.fn();
        const toArray = vi
            .fn()
            .mockResolvedValueOnce(Array.from({ length: 51 }, (_, index) => makeJob(index)))
            .mockResolvedValueOnce([makeJob(51)]);
        const cursorChain = { toArray };
        limit.mockReturnValue(cursorChain);
        skip.mockReturnValue({ limit });
        const sort = vi.fn().mockReturnValue({ skip });
        const find = vi.fn().mockReturnValue({ sort });
        const collection = { find } as unknown as Collection<EnrichedJob>;
        const sentPayloads: unknown[] = [];
        const reply = {
            code: vi.fn().mockReturnThis(),
            send: vi.fn((payload: unknown) => {
                sentPayloads.push(payload);
            }),
        } as unknown as FastifyReply;
        const handler = JobsHandler({ jobsCollection: collection });
        const makeRequest = (query: JobsPageQuery) => ({
            query,
            log: {
                error: vi.fn(),
                warn: vi.fn(),
            },
        }) as unknown as FastifyRequest<{ Querystring: JobsPageQuery }>;
        const userId = "29ea44c8-6583-484f-a83e-bf7efaa6471d";

        await handler.getJobsHandler(makeRequest({ userId }), reply);
        const firstPage = sentPayloads[0] as JobsPageResponse;
        expect(firstPage.jobs).toHaveLength(50);
        expect(firstPage.pagination.hasMore).toBe(true);
        expect(firstPage.pagination.nextCursor).not.toBeNull();

        await handler.getJobsHandler(
            makeRequest({ userId, cursor: firstPage.pagination.nextCursor ?? undefined }),
            reply,
        );
        const secondPage = sentPayloads[1] as JobsPageResponse;
        expect(secondPage.jobs.map((job) => job.id)).toEqual(["job-51"]);
        expect(secondPage.pagination.hasMore).toBe(false);
        expect(skip).toHaveBeenLastCalledWith(50);
    });
});
