import { describe, expect, it } from "vitest";
import { isCareerTimelinePreferenceWithoutRole } from "./dream-job-aspiration-guard.utils";

describe("isCareerTimelinePreferenceWithoutRole", () => {
    it("returns true for long-term direction preference without a role", () => {
        expect(isCareerTimelinePreferenceWithoutRole("im looking for a long term direction")).toBe(true);
    });

    it("returns false when user explicitly names an aspiration", () => {
        expect(isCareerTimelinePreferenceWithoutRole("I want to be a Startup CEO")).toBe(false);
    });

    it("returns false for explicit want to become", () => {
        expect(isCareerTimelinePreferenceWithoutRole("I want to become an architect")).toBe(false);
    });
});
