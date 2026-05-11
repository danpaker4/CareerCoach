import { describe, expect, it } from "vitest";
import { ConversationModeService } from "./conversation-mode.service";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import { createEmptyProfileSignals } from "../career-profile/career-profile.utils";

const buildProfile = (): UserCareerProfile => ({
    userId: "u1",
    ...createEmptyProfileSignals(),
    salaryExpectation: null,
    locationPreference: null,
    remotePreference: null,
    senioritySignal: null,
    uncertaintyLevel: 0.9,
    profileSummaryText: "",
    profileSummaryEmbedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
});

describe("ConversationModeService", () => {
    it("detects deep discovery for unsure users", () => {
        const service = new ConversationModeService();
        const mode = service.detectMode(
            "I don't know what fits me",
            buildProfile(),
            {
                skillsConfidence: 30,
                goalsConfidence: 20,
                preferencesConfidence: 25,
                workStyleConfidence: 15,
                domainConfidence: 10,
                seniorityConfidence: 40,
                searchReadinessConfidence: 25,
                discoveryConfidence: 80,
            }
        );
        expect(mode).toBe("DEEP_DISCOVERY");
    });
});
