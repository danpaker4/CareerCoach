import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    conversationHasDreamJobContext,
    hasDreamJobIntent,
    hasExplicitFastSearchIntent,
    hasNearTermJobSearchIntent,
    hasTimelineUncertaintyIntent,
    resolveConversationModeOverride,
    shouldEnterDreamJobMode,
    shouldPreferGuidedOverDreamJob,
} from "../conversation-mode.utils";

describe("hasDreamJobIntent", () => {
    it("detects founder startup messages", () => {
        assert.equal(
            hasDreamJobIntent("i want to be a founder of startup that will find a solution to object detection with drones"),
            true,
        );
    });

    it("detects looking for something in the future", () => {
        assert.equal(hasDreamJobIntent("im looking for something in the future"), true);
    });
});

describe("hasNearTermJobSearchIntent", () => {
    it("detects short-term job seeking", () => {
        assert.equal(
            hasNearTermJobSearchIntent("i want to find a job in a short term as data engineering"),
            true,
        );
    });

    it("detects explicit find-me-a-job phrasing", () => {
        assert.equal(hasNearTermJobSearchIntent("find me a job as backend developer"), true);
    });

    it("does not treat bare yes as near-term search", () => {
        assert.equal(hasNearTermJobSearchIntent("yes"), false);
    });
});

describe("timeline and mode overrides", () => {
    it("prefers guided when timeline is unclear", () => {
        assert.equal(hasTimelineUncertaintyIntent("im not sure if i want short or long term"), true);
        assert.equal(shouldPreferGuidedOverDreamJob("im not sure if i want short or long term"), true);
    });

    it("routes short-term job seeking to guided, not fast search", () => {
        const message = "i want to find a job in a short term as data engineering";
        assert.equal(hasExplicitFastSearchIntent(message), false);
        assert.equal(shouldPreferGuidedOverDreamJob(message), true);
        assert.equal(
            resolveConversationModeOverride({
                message,
                existingDreamJob: null,
                hasActiveDreamJobFlow: true,
                stickyDreamJobFromHistory: true,
                detectedMode: "DREAMJOB",
            }),
            "GUIDED",
        );
    });

    it("routes explicit search commands to fast search", () => {
        const message = "find me a job as backend developer";
        assert.equal(hasExplicitFastSearchIntent(message), true);
        assert.equal(
            resolveConversationModeOverride({
                message,
                existingDreamJob: null,
                hasActiveDreamJobFlow: true,
                stickyDreamJobFromHistory: true,
                detectedMode: "GUIDED",
            }),
            "FAST_SEARCH",
        );
    });

    it("does not enter dream-job mode for short-term job intent", () => {
        assert.equal(
            shouldEnterDreamJobMode("i want to find a job in a short term as data engineering", null),
            false,
        );
    });
});

describe("conversationHasDreamJobContext", () => {
    it("returns true when a recent user message stated future intent", () => {
        const hasContext = conversationHasDreamJobContext([
            { role: "assistant", content: "What excites you?" },
            { role: "user", content: "im looking for something in the future" },
            { role: "assistant", content: "Let's explore long-term career aspirations!" },
            { role: "user", content: "yes" },
        ]);
        assert.equal(hasContext, true);
    });
});
