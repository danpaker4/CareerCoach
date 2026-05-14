import { describe, expect, it } from "vitest";
import { JobRankingService } from "./job-ranking.service";
import { createEmptyProfileSignals } from "../../career-profile/career-profile.utils";
import type { UserCareerProfile } from "../../career-profile/career-profile.types";

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
});
