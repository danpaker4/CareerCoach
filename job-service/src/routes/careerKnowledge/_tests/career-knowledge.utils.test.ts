import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeRoleCategory, seniorityRank } from "../career-knowledge.utils";

describe("career-knowledge.utils", () => {
    it("normalizes role titles and strips company suffixes", () => {
        const category = normalizeRoleCategory("Senior Backend Engineer at Meta", "senior");
        assert.equal(category.includes("Meta"), false);
        assert.equal(category.toLowerCase().includes("backend"), true);
    });

    it("orders seniority ranks correctly", () => {
        assert.ok(seniorityRank("junior") < seniorityRank("senior"));
        assert.ok(seniorityRank("senior") < seniorityRank("staff"));
    });
});
