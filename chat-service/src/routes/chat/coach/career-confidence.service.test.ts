import { describe, expect, it } from "vitest";
import { CareerConfidenceService } from "./career-confidence.service";
import type { UserCareerProfile } from "../../career-profile/career-profile.types";
import { createEmptyProfileSignals } from "../../career-profile/career-profile.utils";

const buildProfile = (): UserCareerProfile => ({
    userId: "u1",
    ...createEmptyProfileSignals(),
    salaryExpectation: null,
    locationPreference: null,
    remotePreference: null,
    senioritySignal: null,
    uncertaintyLevel: 0.5,
    profileSummaryText: "",
    profileSummaryEmbedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
});

describe("CareerConfidenceService", () => {
    it("increases search readiness when profile is clear", () => {
        const service = new CareerConfidenceService();
        const profile = buildProfile();
        profile.technologies = [{ value: "Node.js", confidence: 0.9, evidence: ["msg"], source: "chat", updatedAt: new Date() }];
        profile.preferredRoles = [{ value: "Backend Engineer", confidence: 0.9, evidence: ["msg"], source: "chat", updatedAt: new Date() }];
        profile.interests = [{ value: "APIs", confidence: 0.8, evidence: ["msg"], source: "chat", updatedAt: new Date() }];
        profile.shortTermGoals = [{ value: "Find backend role", confidence: 0.8, evidence: ["msg"], source: "chat", updatedAt: new Date() }];
        const confidence = service.calculateConfidence(profile);
        expect(confidence.searchReadinessConfidence).toBeGreaterThan(30);
    });
});
