import { describe, expect, it } from "vitest";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import { toJobSeed, toSeededJob } from "../job-seed.utils";

const enrichedJob: EnrichedJob = {
    id: "mock-security-engineer",
    jobTitle: "Security Engineer",
    url: "https://example.test/jobs/security-engineer",
    company: "Example Security",
    seniority: "Junior",
    description: "Build and operate security automation for cloud services.",
    location: "Remote",
    lon: null,
    lat: null,
    salary: 14_000,
    requirements: ["TypeScript", "Security fundamentals"],
    benefits: ["Training budget"],
    languages: ["TypeScript"],
    frameworks: [],
    databases: [],
    platforms: ["AWS"],
    tools: ["Docker"],
    mustKnowSkills: ["Security fundamentals"],
    niceToHaveSkills: ["AWS"],
    searchableText: "Security Engineer TypeScript AWS",
    searchEmbedding: [0.1, 0.2],
    searchEmbeddingModel: "local-model",
    searchEmbeddingStatus: "ready",
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

describe("job seed utilities", () => {
    it("exports stable job data without database or embedding metadata", () => {
        const seed = toJobSeed(enrichedJob);

        expect(seed).toMatchObject({
            id: "mock-security-engineer",
            jobTitle: "Security Engineer",
            salary: 14_000,
        });
        expect("searchEmbedding" in seed).toBe(false);
        expect("createdAt" in seed).toBe(false);
        expect("updatedAt" in seed).toBe(false);
    });

    it("marks imported seed jobs for embedding repair", () => {
        const imported = toSeededJob(toJobSeed(enrichedJob));

        expect(imported.searchEmbedding).toEqual([]);
        expect(imported.requirements).toEqual(["TypeScript", "Security fundamentals"]);
    });
});
