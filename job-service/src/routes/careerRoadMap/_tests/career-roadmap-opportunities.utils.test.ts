import type { Collection } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import type { EnrichedJob } from "../../../poller/job-poller-api-stack/stages/enrich/types";
import { discoverStageOpportunities } from "../career-roadmap-opportunities.utils";

describe("discoverStageOpportunities", () => {
    it("supports legacy jobs without enrichment arrays", async () => {
        const legacyJob = {
            id: "legacy-job",
            jobTitle: "Engineering Manager",
            company: "Example",
            seniority: "manager",
            url: "https://example.test/jobs/legacy-job",
            description: "Lead an engineering team.",
            requirements: ["Team leadership", null],
            frameworks: "not-an-array",
            lon: null,
            lat: null,
        } as unknown as EnrichedJob;
        const toArray = vi.fn().mockResolvedValue([legacyJob]);
        const limit = vi.fn().mockReturnValue({ toArray });
        const find = vi.fn().mockReturnValue({ limit });
        const collection = { find } as unknown as Collection<EnrichedJob>;

        const result = await discoverStageOpportunities(collection, {
            roleCategories: ["Engineering Manager"],
            userSkills: ["Leadership"],
        });

        expect(result.opportunities).toHaveLength(1);
        expect(result.opportunities[0]).toMatchObject({
            jobId: "legacy-job",
            requirements: ["Team leadership"],
            missingRequirements: [],
        });
    });
});
