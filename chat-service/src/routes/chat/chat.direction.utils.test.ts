import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    extractWorkDirectionQuery,
    isTimelineOrUrgencyCandidate,
    isWorkDirectionIntent,
} from "./chat.direction.utils";

describe("isTimelineOrUrgencyCandidate", () => {
    it("detects timeline phrases", () => {
        assert.equal(isTimelineOrUrgencyCandidate("in the next 2 months"), true);
        assert.equal(isTimelineOrUrgencyCandidate("soon"), true);
        assert.equal(isTimelineOrUrgencyCandidate("asap"), true);
    });

    it("allows role and domain phrases", () => {
        assert.equal(isTimelineOrUrgencyCandidate("cybersecurity"), false);
        assert.equal(isTimelineOrUrgencyCandidate("data analyst"), false);
    });
});

describe("extractWorkDirectionQuery", () => {
    it("does not treat timeline hedging as a role query", () => {
        const message = "i need to change jobs soon, maybe in the next 2 months";
        assert.equal(extractWorkDirectionQuery(message), null);
        assert.equal(isWorkDirectionIntent(message), false);
    });

    it("still extracts explicit domain choices after maybe", () => {
        assert.equal(extractWorkDirectionQuery("maybe cybersecurity"), "cybersecurity");
        assert.equal(extractWorkDirectionQuery("maybe data analyst"), "data analyst");
    });

    it("still extracts other work-direction patterns", () => {
        assert.equal(extractWorkDirectionQuery("i want to work in backend"), "backend");
        assert.equal(extractWorkDirectionQuery("let's go with data analyst"), "data analyst");
    });
});
