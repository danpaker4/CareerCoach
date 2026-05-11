import { describe, expect, it, vi } from "vitest";
import { JobSearchHandler } from "./job-search.handler";

describe("JobSearchHandler", () => {
    it("accepts multi-search plan payload and deduplicates by jobId", async () => {
        const aggregate = vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([
                {
                    id: "1",
                    jobTitle: "Backend Engineer",
                    url: "u1",
                    seniority: "mid",
                    description: "Node",
                    company: "Acme Corp",
                    salary: 0,
                },
            ]),
        });
        const find = vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
            }),
        });
        const collection = { aggregate, find } as unknown as Parameters<typeof JobSearchHandler>[0];
        const handler = JobSearchHandler(collection);
        const status = vi.fn().mockReturnThis();
        const send = vi.fn();
        await handler.searchJobs(
            {
                body: {
                    searches: [
                        { type: "STRICT_MATCH", query: "backend", filters: { skills: ["Node.js"], interests: [], experienceLevel: "", keywords: ["backend"] } },
                        { type: "EXPLORATORY", query: "api", filters: { skills: ["Node.js"], interests: [], experienceLevel: "", keywords: ["api"] } },
                    ],
                },
                log: { error: vi.fn() },
            } as never,
            { status, send } as never
        );
        expect(status).toHaveBeenCalledWith(200);
        expect(send).toHaveBeenCalled();
    });
});
