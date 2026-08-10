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

    it("parses compact JSON wrapped in a markdown fence", () => {
        const decision = parseChatTurnDecisionFromJson(`Here is the result:\n\`\`\`json
{"r":"Tell me about the backend work you enjoy.","m":"G","ready":false,"target":null,"advance":false,"search":false}
\`\`\``);

        assert.equal(decision.reply, "Tell me about the backend work you enjoy.");
        assert.equal(decision.modeDetection.mode, "GUIDED");
    });

    it("accepts descriptive mode names returned by smaller models", () => {
        const decision = parseChatTurnDecisionFromJson(JSON.stringify({
            r: "I can search for backend roles.",
            m: "near_term",
            ready: true,
            target: "Backend Engineer",
            advance: true,
            search: true,
        }));

        assert.equal(decision.modeDetection.mode, "NEAR_TERM");
        assert.equal(decision.modeDetection.searchQuery, "Backend Engineer");
    });
});
