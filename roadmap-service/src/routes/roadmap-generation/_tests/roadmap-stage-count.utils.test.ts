import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveStageCountFromTargetYears } from "../roadmap-stage-count.utils";

describe("resolveStageCountFromTargetYears", () => {
    it("creates about two milestones per year", () => {
        assert.equal(resolveStageCountFromTargetYears(1), 2);
        assert.equal(resolveStageCountFromTargetYears(2), 4);
        assert.equal(resolveStageCountFromTargetYears(3), 6);
    });

    it("caps stage count for long timelines", () => {
        assert.equal(resolveStageCountFromTargetYears(10), 12);
    });
});
