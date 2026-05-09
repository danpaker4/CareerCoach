import { describe, expect, it } from "vitest";
import { JobFollowUpIntentService } from "./job-follow-up-intent.service";

describe("JobFollowUpIntentService", () => {
    const service = new JobFollowUpIntentService();

    it("detects follow-up skill question", () => {
        const result = service.detect("what is the mustKnowSkills?");
        expect(result.isFollowUp).toBe(true);
        expect(result.requestedField).toBe("mustKnowSkills");
    });

    it("does not detect follow-up for explicit new search", () => {
        const result = service.detect("search again and show more jobs");
        expect(result.isFollowUp).toBe(false);
        expect(result.isExplicitNewSearch).toBe(true);
    });
});
