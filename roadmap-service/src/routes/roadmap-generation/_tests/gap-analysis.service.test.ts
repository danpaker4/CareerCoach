import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGapAnalysis } from "../gap-analysis.service";

describe("gap-analysis.service", () => {
    it("identifies missing skills from market requirements", () => {
        const gap = buildGapAnalysis({
            dreamJob: "Senior Backend Engineer",
            user: {
                currentJob: "Backend Developer",
                currentRoleSummary: "Backend Developer",
                userSkills: ["Node.js", "PostgreSQL"],
                demonstratedResponsibilities: [],
                roleExperienceYears: 3,
                roleExperienceLevel: "mid",
                preferredDomains: [],
                senioritySignal: "mid",
                longTermGoals: [],
            },
            market: {
                roleCategory: "Senior Backend Engineer",
                commonSkills: ["Node.js", "PostgreSQL", "Kubernetes", "System Design"],
                responsibilities: ["Lead API design", "Mentor juniors"],
                leadershipSignals: ["Mentor team members"],
                architectureSignals: ["Design distributed systems"],
                seniorityDistribution: { senior: 5, mid: 2 },
            },
        });

        assert.ok(gap.skillsMissing.includes("Kubernetes"));
        assert.ok(gap.skillsPresent.includes("Node.js"));
        assert.ok(gap.leadershipGaps.length > 0);
        assert.ok(gap.experienceGapSummary.length > 0);
    });
});
