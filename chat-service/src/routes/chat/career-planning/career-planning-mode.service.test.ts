import { describe, expect, it } from "vitest";
import type { Conversation } from "../conversation/conversation.model";
import { CareerPlanningModeService } from "./career-planning-mode.service";

const baseConversation = (overrides: Partial<Conversation>): Conversation => ({
    userId: "u1",
    achievements: [],
    messages: [],
    stageProgress: {
        currentStageIndex: 0,
        currentStageId: "achievements",
        completedStageIds: [],
        awaitingConfirmation: false,
        stageNotes: {},
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

describe("CareerPlanningModeService", () => {
    const service = new CareerPlanningModeService();

    it("classifies future and persists from unknown", () => {
        const conv = baseConversation({
            careerPlanningMode: "UNKNOWN",
            messages: [{ role: "user", content: "hi", timestamp: new Date() }],
        });
        const r = service.resolve(conv, "I am thinking about the future and not searching now", {
            isBackgroundOnlyMessage: false,
        });
        expect(r.effectiveMode).toBe("FUTURE_PLANNING");
        expect(r.nextStoredMode).toBe("FUTURE_PLANNING");
    });

    it("classifies immediate with strong job phrase when unknown", () => {
        const conv = baseConversation({
            careerPlanningMode: "UNKNOWN",
            messages: [{ role: "user", content: "x", timestamp: new Date() }],
        });
        const r = service.resolve(conv, "show me jobs in backend", { isBackgroundOnlyMessage: false });
        expect(r.effectiveMode).toBe("IMMEDIATE");
        expect(r.nextStoredMode).toBe("IMMEDIATE");
    });

    it("tie-break prefers immediate when explicit job search and future words", () => {
        const conv = baseConversation({
            careerPlanningMode: "FUTURE_PLANNING",
            messages: [{ role: "user", content: "a", timestamp: new Date() }],
        });
        const r = service.resolve(conv, "show me jobs for my future", { isBackgroundOnlyMessage: false });
        expect(r.effectiveMode).toBe("IMMEDIATE");
        expect(r.nextStoredMode).toBe("IMMEDIATE");
    });

    it("switches future from immediate mid-chat", () => {
        const conv = baseConversation({
            careerPlanningMode: "IMMEDIATE",
            messages: [{ role: "user", content: "a", timestamp: new Date() }],
        });
        const r = service.resolve(conv, "Actually I am not job hunting — I want long-term direction", {
            isBackgroundOnlyMessage: false,
        });
        expect(r.effectiveMode).toBe("FUTURE_PLANNING");
        expect(r.nextStoredMode).toBe("FUTURE_PLANNING");
    });

    it("switches immediate from future mid-chat", () => {
        const conv = baseConversation({
            careerPlanningMode: "FUTURE_PLANNING",
            messages: [{ role: "user", content: "a", timestamp: new Date() }],
        });
        const r = service.resolve(conv, "ok now search jobs for me", { isBackgroundOnlyMessage: false });
        expect(r.effectiveMode).toBe("IMMEDIATE");
        expect(r.nextStoredMode).toBe("IMMEDIATE");
    });

    it("asks distinction on early ambiguous unknown and persists unknown", () => {
        const conv = baseConversation({
            messages: [{ role: "user", content: "hello", timestamp: new Date() }],
        });
        const r = service.resolve(conv, "hello", { isBackgroundOnlyMessage: false });
        expect(r.shouldAskDistinctionQuestion).toBe(true);
        expect(r.effectiveMode).toBe("UNKNOWN");
        expect(r.nextStoredMode).toBe("UNKNOWN");
    });

    it("uses rich intro on first background message", () => {
        const conv = baseConversation({
            messages: [{ role: "user", content: "intro", timestamp: new Date() }],
        });
        const msg = "hi im gal im working as a software developer in the last 5 years";
        const r = service.resolve(conv, msg, { isBackgroundOnlyMessage: true });
        expect(r.shouldAskDistinctionQuestion).toBe(true);
        expect(r.useBackgroundAckDistinction).toBe(true);
        expect(service.buildBackgroundAckAndTimelineQuestion(msg)).toContain("Gal");
    });

    it("defaults immediate after distinction and still ambiguous", () => {
        const conv = baseConversation({
            careerPlanningMode: "UNKNOWN",
            careerPlanningDistinctionAskedAt: new Date(),
            messages: [
                { role: "user", content: "hello", timestamp: new Date() },
                { role: "assistant", content: "?", timestamp: new Date() },
                { role: "user", content: "maybe", timestamp: new Date() },
            ],
        });
        const r = service.resolve(conv, "maybe", { isBackgroundOnlyMessage: false });
        expect(r.forceImmediateAfterAmbiguousPrompt).toBe(true);
        expect(r.nextStoredMode).toBe("IMMEDIATE");
    });

    it("explicit job phrase switches future to immediate", () => {
        const conv = baseConversation({
            careerPlanningMode: "FUTURE_PLANNING",
            messages: [{ role: "user", content: "a", timestamp: new Date() }],
        });
        const r = service.resolve(conv, "I want a job in cybersecurity", { isBackgroundOnlyMessage: false });
        expect(r.effectiveMode).toBe("IMMEDIATE");
        expect(r.nextStoredMode).toBe("IMMEDIATE");
    });
});
