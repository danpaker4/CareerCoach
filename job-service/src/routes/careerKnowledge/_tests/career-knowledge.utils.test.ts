import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeRoleCategory, seniorityRank, isUsableSkill } from "../career-knowledge.utils";

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

describe("isUsableSkill", () => {
    it("keeps a real skill", () => {
        for (const skill of ["Node.js", "System design", "REST APIs", "Kubernetes", "C++"]) {
            assert.equal(isUsableSkill(skill), true, skill);
        }
    });

    it("rejects the enrichment placeholder that would become a roadmap stage", () => {
        assert.equal(
            isUsableSkill("mid level experience relevant to Working Student for Battery Integration"),
            false
        );
    });

    it("rejects a URL", () => {
        assert.equal(isUsableSkill("Go here: https://build"), false);
    });

    it("rejects a sentence", () => {
        assert.equal(isUsableSkill("Ability to deliver features in production environments"), false);
    });

    it("rejects a board tag that says nothing about the role", () => {
        for (const tag of ["chat", "remote", "full time", "other"]) {
            assert.equal(isUsableSkill(tag), false, tag);
        }
    });
});
