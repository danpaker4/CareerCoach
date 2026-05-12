import { describe, expect, it } from "vitest";
import { JobRankingService } from "./job-ranking.service";
import { createEmptyProfileSignals } from "../career-profile/career-profile.utils";
import type { UserCareerProfile } from "../career-profile/career-profile.types";

const buildProfile = (): UserCareerProfile => ({
    userId: "u1",
    ...createEmptyProfileSignals(),
    salaryExpectation: null,
    locationPreference: null,
    remotePreference: null,
    senioritySignal: "mid",
    uncertaintyLevel: 0.3,
    profileSummaryText: "",
    profileSummaryEmbedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    technologies: [{ value: "Node.js", confidence: 0.9, evidence: ["msg"], source: "chat", updatedAt: new Date() }],
    interests: [{ value: "backend", confidence: 0.8, evidence: ["msg"], source: "chat", updatedAt: new Date() }],
    workStyle: [{ value: "analytical", confidence: 0.8, evidence: ["msg"], source: "chat", updatedAt: new Date() }],
});

describe("JobRankingService", () => {
    it("ranks jobs and returns score breakdown", () => {
        const service = new JobRankingService();
        const ranked = service.rankJobs(buildProfile(), [
            { jobId: "1", jobTitle: "Backend Engineer", url: "a", seniority: "mid", description: "Node.js APIs and backend services" },
            { jobId: "2", jobTitle: "Designer", url: "b", seniority: "junior", description: "UI/UX and visual design" },
        ]);
        expect(ranked[0]?.jobId).toBe("1");
        expect(ranked[0]?.scoreBreakdown.skillMatchScore).toBeGreaterThan(0);
    });

    it("boosts ranking when dream job title overlaps job text", () => {
        const service = new JobRankingService();
        const profile = buildProfile();
        const jobs = [
            { jobId: "1", jobTitle: "Designer", url: "a", seniority: "junior", description: "UI and branding" },
            {
                jobId: "2",
                jobTitle: "Security Engineer",
                url: "b",
                seniority: "mid",
                description: "Application security and threat modeling",
            },
        ];
        const withoutDream = service.rankJobs(profile, jobs);
        const withDream = service.rankJobs(profile, jobs, "Application Security Engineer");
        expect(withoutDream[0]?.jobId).toBe("1");
        expect(withDream[0]?.jobId).toBe("2");
        expect(withDream[0]?.finalScore).toBeGreaterThanOrEqual(withoutDream.find((r) => r.jobId === "2")?.finalScore ?? 0);
    });
});
