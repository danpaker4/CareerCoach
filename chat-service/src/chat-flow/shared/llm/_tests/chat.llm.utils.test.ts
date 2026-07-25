import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChatTurnDecisionFromJson, parseLlmDecisionFromJson } from "../chat.llm.utils";

describe("compact chat LLM responses", () => {
    it("maps a compact near-term decision into the existing domain contract", () => {
        const decision = parseChatTurnDecisionFromJson(JSON.stringify({
            r: "I can look for backend roles now.",
            m: "N",
            ready: true,
            target: "Backend Engineer",
            advance: true,
            search: true,
            skills: ["TypeScript", "Node.js"],
            interests: ["backend"],
            level: "mid",
            keywords: ["API"],
        }));

        assert.equal(decision.reply, "I can look for backend roles now.");
        assert.equal(decision.shouldSearchJobs, true);
        assert.equal(decision.shouldAdvanceStage, true);
        assert.equal(decision.modeDetection.mode, "NEAR_TERM");
        assert.equal(decision.modeDetection.searchQuery, "Backend Engineer");
        assert.equal(decision.modeDetection.shouldSearchJobs, true);
        assert.deepEqual(decision.searchFilters, {
            skills: ["TypeScript", "Node.js"],
            interests: ["backend"],
            experienceLevel: "mid",
            keywords: ["API"],
        });
    });

    it("maps compact recommendation ids without exposing a second search request", () => {
        const decision = parseLlmDecisionFromJson(JSON.stringify({
            r: "This role fits your API background. Add it to your pipeline?",
            ids: ["job-123"],
        }));

        assert.equal(decision.shouldSearchJobs, false);
        assert.deepEqual(decision.recommendedJobIds, ["job-123"]);
    });
});
