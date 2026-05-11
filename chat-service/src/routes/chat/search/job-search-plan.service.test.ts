import { describe, expect, it } from "vitest";
import { JobSearchPlanService } from "./job-search-plan.service";
import type { UserCareerProfile } from "../career-profile/career-profile.types";

const emptySignals = {
    strengths: [],
    weakSignals: [],
    preferredRoles: [],
    dislikedRoles: [],
    preferredDomains: [],
    dislikedDomains: [],
    technologies: [],
    softSkills: [],
    motivations: [],
    interests: [],
    dislikes: [],
    workStyle: [],
    personalitySignals: [],
    longTermGoals: [],
    shortTermGoals: [],
    extractedKeywords: [],
};

const minimalProfile: UserCareerProfile = {
    userId: "00000000-0000-4000-8000-000000000001",
    ...emptySignals,
    preferredRoles: [{ value: "Engineer", confidence: 0.5, evidence: [], source: "chat", updatedAt: new Date() }],
    interests: [{ value: "backend", confidence: 0.5, evidence: [], source: "chat", updatedAt: new Date() }],
    technologies: [{ value: "TypeScript", confidence: 0.5, evidence: [], source: "chat", updatedAt: new Date() }],
    salaryExpectation: null,
    locationPreference: null,
    remotePreference: null,
    senioritySignal: null,
    uncertaintyLevel: 0,
    profileSummaryText: "",
    profileSummaryEmbedding: [],
    updatedAt: new Date(),
    createdAt: new Date(),
};

describe("JobSearchPlanService.buildBroaderPlan", () => {
    const service = new JobSearchPlanService();

    it("prepends an ADJACENT search before the base plan", () => {
        const baseFilters = {
            skills: [],
            interests: ["security"],
            experienceLevel: "",
            keywords: ["SOC"],
        };
        const plan = service.buildBroaderPlan(minimalProfile, baseFilters);
        expect(plan.searches[0]?.type).toBe("ADJACENT");
        expect(plan.searches.length).toBeGreaterThan(3);
        expect(plan.searches[0]?.filters.keywords.join(" ")).toContain("entry level");
    });
});
