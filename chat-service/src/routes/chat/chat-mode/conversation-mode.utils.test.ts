import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conversationHasDreamJobContext, hasDreamJobIntent } from "./conversation-mode.utils";

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
