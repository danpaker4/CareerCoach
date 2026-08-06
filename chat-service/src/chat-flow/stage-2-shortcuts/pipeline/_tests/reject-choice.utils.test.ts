import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatMessage } from "../../../api/shared/chat-message.types";
import {
    buildRejectChoicePrompt,
    detectRejectChoice,
    extractRejectChoiceTitle,
    wasRejectChoiceOfferedLast,
} from "../pipeline-reject/reject-choice.utils";

const assistant = (content: string): ChatMessage => ({ role: "assistant", content, timestamp: new Date() });
const user = (content: string): ChatMessage => ({ role: "user", content, timestamp: new Date() });

describe("reject choice detection", () => {
    it("reads a request to keep searching as BROADEN", () => {
        assert.equal(detectRejectChoice("broaden the search please"), "BROADEN");
        assert.equal(detectRejectChoice("keep looking"), "BROADEN");
        assert.equal(detectRejectChoice("show me more options"), "BROADEN");
    });

    it("reads a request to be alerted later as WISHLIST", () => {
        assert.equal(detectRejectChoice("save it to my wishlist"), "WISHLIST");
        assert.equal(detectRejectChoice("notify me when something opens"), "WISHLIST");
    });

    it("returns null for an unrelated message so the normal flow still runs", () => {
        assert.equal(detectRejectChoice("what skills should I learn?"), null);
        assert.equal(detectRejectChoice(""), null);
    });

    it("returns null when the message asks for both at once", () => {
        assert.equal(detectRejectChoice("save it and keep looking"), null);
    });
});

describe("reject choice prompt round-trip", () => {
    it("recognizes its own prompt as the last assistant turn", () => {
        const messages = [user("none of these"), assistant(buildRejectChoicePrompt("QA Engineer"))];
        assert.equal(wasRejectChoiceOfferedLast(messages), true);
    });

    it("does not fire when a later assistant message replaced it", () => {
        const messages = [assistant(buildRejectChoicePrompt("QA Engineer")), assistant("Anything else?")];
        assert.equal(wasRejectChoiceOfferedLast(messages), false);
    });

    it("recovers the proposed title from the prompt", () => {
        const messages = [assistant(buildRejectChoicePrompt("Senior QA Engineer"))];
        assert.equal(extractRejectChoiceTitle(messages), "Senior QA Engineer");
    });
});
