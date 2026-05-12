import { describe, expect, it } from "vitest";
import { ChatSearchIntentService } from "./chat-search-intent.service";

describe("ChatSearchIntentService", () => {
    const service = new ChatSearchIntentService();

    it("does not treat software developer background as domain exploration (java substring)", () => {
        const msg = "hi im gal im working as a software developer in the last 5 years";
        expect(service.detectDomainExplorationTarget(msg)).toBeNull();
        expect(service.isWorkDirectionIntent(msg)).toBe(false);
        expect(service.detectSearchIntent(msg, null, false)).toBe("BACKGROUND_INFORMATION");
    });

    it("does not match work direction from working (substring of working)", () => {
        const msg = "i have been working remotely for 3 years";
        expect(service.isWorkDirectionIntent(msg)).toBe(false);
    });

    it("matches work direction when user says work but not working", () => {
        const msg = "i want work in backend";
        expect(service.isWorkDirectionIntent(msg)).toBe(true);
    });

    it("allows mongo search only for IMMEDIATE with work direction or explicit search", () => {
        expect(
            service.allowsMongoJobSearch({
                careerPlanningMode: "UNKNOWN",
                intent: "WORK_DIRECTION_INTENT",
            })
        ).toBe(false);
        expect(
            service.allowsMongoJobSearch({
                careerPlanningMode: "IMMEDIATE",
                intent: "BACKGROUND_INFORMATION",
            })
        ).toBe(false);
        expect(
            service.allowsMongoJobSearch({
                careerPlanningMode: "IMMEDIATE",
                intent: "WORK_DIRECTION_INTENT",
            })
        ).toBe(true);
        expect(
            service.allowsMongoJobSearch({
                careerPlanningMode: "IMMEDIATE",
                intent: "EXPLICIT_JOB_SEARCH",
            })
        ).toBe(true);
    });

    it("detects explicit job search phrases", () => {
        expect(service.detectSearchIntent("show me jobs in tel aviv", null, false)).toBe("EXPLICIT_JOB_SEARCH");
    });

    it("allows pipeline closing after pipeline reject in IMMEDIATE mode", () => {
        expect(
            service.allowsPipelineClosingQuestion({
                careerPlanningMode: "IMMEDIATE",
                intent: "PIPELINE_REJECT",
            })
        ).toBe(true);
    });
});
