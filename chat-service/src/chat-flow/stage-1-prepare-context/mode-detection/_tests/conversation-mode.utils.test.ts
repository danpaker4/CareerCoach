import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isConversationMode, parseConversationModeDetectionResult } from "../conversation-mode.utils";

describe("isConversationMode", () => {
    it("accepts the three supported modes", () => {
        assert.equal(isConversationMode("DREAMJOB"), true);
        assert.equal(isConversationMode("NEAR_TERM"), true);
        assert.equal(isConversationMode("GUIDED"), true);
    });

    it("rejects removed and unknown modes", () => {
        assert.equal(isConversationMode("FAST_SEARCH"), false);
        assert.equal(isConversationMode("DEEP_DISCOVERY"), false);
        assert.equal(isConversationMode(42), false);
    });
});

describe("parseConversationModeDetectionResult", () => {
    it("parses a ready dream-job detection with a title", () => {
        const result = parseConversationModeDetectionResult(
            JSON.stringify({
                mode: "DREAMJOB",
                readinessScore: 90,
                isReady: true,
                missingInformation: [],
                dreamJobTitle: "Data Engineer",
                searchQuery: null,
            })
        );
        assert.deepEqual(result, {
            mode: "DREAMJOB",
            readinessScore: 90,
            isReady: true,
            missingInformation: [],
            dreamJobTitle: "Data Engineer",
            shouldSearchJobs: false,
            searchQuery: undefined,
        });
    });

    it("marks near-term ready detections as should search jobs", () => {
        const result = parseConversationModeDetectionResult(
            JSON.stringify({
                mode: "NEAR_TERM",
                readinessScore: 85,
                isReady: true,
                missingInformation: [],
                dreamJobTitle: null,
                searchQuery: "data engineer",
            })
        );
        assert.equal(result?.shouldSearchJobs, true);
        assert.equal(result?.searchQuery, "data engineer");
        assert.equal(result?.dreamJobTitle, undefined);
    });

    it("keeps near-term not-ready detections from searching and returns missing information", () => {
        const result = parseConversationModeDetectionResult(
            JSON.stringify({
                mode: "NEAR_TERM",
                readinessScore: 40,
                isReady: false,
                missingInformation: ["target role for the near time"],
                dreamJobTitle: null,
                searchQuery: null,
            })
        );
        assert.equal(result?.shouldSearchJobs, false);
        assert.deepEqual(result?.missingInformation, ["target role for the near time"]);
    });

    it("clamps readiness score into the 0-100 range", () => {
        const result = parseConversationModeDetectionResult(
            JSON.stringify({ mode: "GUIDED", readinessScore: 250, isReady: false, missingInformation: [] })
        );
        assert.equal(result?.readinessScore, 100);
    });

    it("returns null for invalid JSON or unknown mode", () => {
        assert.equal(parseConversationModeDetectionResult("not json"), null);
        assert.equal(
            parseConversationModeDetectionResult(JSON.stringify({ mode: "FAST_SEARCH", isReady: true })),
            null
        );
    });
});
