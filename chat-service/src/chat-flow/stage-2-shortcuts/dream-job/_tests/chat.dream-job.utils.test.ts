import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseMostSpecificDreamJobTitle, inferDreamJobTitleFromMessage, parseTargetYearsFromMessage } from "../chat.dream-job.utils";

describe("parseTargetYearsFromMessage", () => {
    it("parses bare numbers and year phrases", () => {
        assert.equal(parseTargetYearsFromMessage("5"), 5);
        assert.equal(parseTargetYearsFromMessage("in 5 years"), 5);
        assert.equal(parseTargetYearsFromMessage("within 3 years"), 3);
        assert.equal(parseTargetYearsFromMessage("about 10 yrs"), 10);
    });

    it("rejects out-of-range values", () => {
        assert.equal(parseTargetYearsFromMessage("0"), undefined);
        assert.equal(parseTargetYearsFromMessage("99"), undefined);
        assert.equal(parseTargetYearsFromMessage("soon"), undefined);
    });
});

describe("inferDreamJobTitleFromMessage", () => {
    it("preserves the industry and company context of executive goals", () => {
        assert.equal(
            inferDreamJobTitleFromMessage("I want to be CEO of a fintech company"),
            "CEO of a Fintech Company"
        );
        assert.equal(
            chooseMostSpecificDreamJobTitle("Chief Executive Officer", "CEO of a Fintech Company"),
            "CEO of a Fintech Company"
        );
    });
});
