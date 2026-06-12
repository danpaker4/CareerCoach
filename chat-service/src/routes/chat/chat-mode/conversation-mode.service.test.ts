import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConversationModeService } from "./conversation-mode.service";
import type { ConfidenceSummary } from "../confidence/confidence.types";

const baseConfidence: ConfidenceSummary = {
    skillsConfidence: 0,
    goalsConfidence: 0,
    preferencesConfidence: 0,
    roleExperienceConfidence: 0,
    domainConfidence: 0,
    seniorityConfidence: 0,
    searchReadinessConfidence: 0,
    discoveryConfidence: 0,
};

describe("ConversationModeService.detectMode", () => {
    const service = new ConversationModeService();

    it("returns DREAMJOB for long-term aspiration signals before FAST_SEARCH", () => {
        const mode = service.detectMode({
            message: "show me jobs in the future — my dream job is founder",
            confidence: { ...baseConfidence, searchReadinessConfidence: 80 },
            existingDreamJob: null,
        });
        assert.equal(mode, "DREAMJOB");
    });

    it("returns FAST_SEARCH when not a dream job signal", () => {
        const mode = service.detectMode({
            message: "show me jobs now",
            confidence: { ...baseConfidence, searchReadinessConfidence: 80 },
            existingDreamJob: null,
        });
        assert.equal(mode, "FAST_SEARCH");
    });

    it("returns DREAMJOB for founder startup aspiration without saying dream job", () => {
        const mode = service.detectMode({
            message: "i want to be a founder of startup that will find a solution to object detection with drones",
            confidence: { ...baseConfidence, searchReadinessConfidence: 90 },
            existingDreamJob: null,
        });
        assert.equal(mode, "DREAMJOB");
    });

    it("skips DREAMJOB when dream job already saved unless change intent", () => {
        const mode = service.detectMode({
            message: "my career goal is to grow",
            confidence: baseConfidence,
            existingDreamJob: "Founder",
        });
        assert.equal(mode, "GUIDED");

        const changeMode = service.detectMode({
            message: "i want to change my dream job to CTO",
            confidence: baseConfidence,
            existingDreamJob: "Founder",
        });
        assert.equal(changeMode, "DREAMJOB");
    });
});
