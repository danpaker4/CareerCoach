import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isInvalidStageTitle, sanitizeStageTitle } from "../stage-title.validator";

describe("stage-title.validator", () => {
    it("rejects company-specific stage titles", () => {
        assert.equal(isInvalidStageTitle("Staff Engineer at Meta"), true);
        assert.equal(isInvalidStageTitle("Architecture Ownership"), false);
    });

    it("sanitizes company suffixes from titles", () => {
        assert.equal(sanitizeStageTitle("Backend Mastery at Google"), "Backend Mastery");
    });
});
