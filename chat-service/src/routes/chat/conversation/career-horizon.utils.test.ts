import { describe, expect, it } from "vitest";
import { inferCareerHorizonTransition } from "./career-horizon.utils";

describe("inferCareerHorizonTransition", () => {
    it("detects long-term phrase", () => {
        expect(inferCareerHorizonTransition("I want long term planning", undefined)).toBe("LONG_TERM");
    });

    it("detects colloquial future-focused phrasing", () => {
        expect(inferCareerHorizonTransition("im looking for something in the future", undefined)).toBe("LONG_TERM");
        expect(inferCareerHorizonTransition("In the future I want to lead", "UNSET")).toBe("LONG_TERM");
    });

    it("detects startup CEO aspiration as long-term", () => {
        expect(inferCareerHorizonTransition("i wanna be a ceo of a big startup", undefined)).toBe("LONG_TERM");
    });

    it("detects immediate over long-term when both appear", () => {
        expect(inferCareerHorizonTransition("long term but find me a job now", "LONG_TERM")).toBe("IMMEDIATE");
    });

    it("returns null when unchanged", () => {
        expect(inferCareerHorizonTransition("hello", "LONG_TERM")).toBeNull();
    });
});
