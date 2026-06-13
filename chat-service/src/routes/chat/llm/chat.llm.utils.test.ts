import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLlmDecisionFromJson } from "./chat.llm.utils";

const baseDecisionJson = {
    reply: "Tell me what role you want to explore.",
    shouldSearchJobs: false,
    recommendedJobIds: [],
    searchFilters: {
        skills: [],
        interests: [],
        experienceLevel: "",
        keywords: [],
    },
};

describe("parseLlmDecisionFromJson", () => {
    it("parses a valid conversation mode", () => {
        const parsed = parseLlmDecisionFromJson(JSON.stringify({
            ...baseDecisionJson,
            mode: "FAST_SEARCH",
        }));

        assert.equal(parsed.mode, "FAST_SEARCH");
    });

    it("falls back to GUIDED when mode is missing", () => {
        const parsed = parseLlmDecisionFromJson(JSON.stringify(baseDecisionJson));

        assert.equal(parsed.mode, "GUIDED");
    });

    it("falls back to GUIDED when mode is invalid", () => {
        const parsed = parseLlmDecisionFromJson(JSON.stringify({
            ...baseDecisionJson,
            mode: "UNKNOWN_MODE",
        }));

        assert.equal(parsed.mode, "GUIDED");
    });
});
