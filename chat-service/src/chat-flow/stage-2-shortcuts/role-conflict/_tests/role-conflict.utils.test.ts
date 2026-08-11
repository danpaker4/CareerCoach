import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    extractClaimedCurrentRole,
    filterOutQaLinkedAchievements,
    filterOutQaLinkedSkills,
    isChatRolePreferredResolution,
    rolesConflict,
} from "../role-conflict.utils";

describe("role conflict utils", () => {
    it("extracts claimed current roles from chat", () => {
        assert.equal(
            extractClaimedCurrentRole("hi my name is gal kosover and im software engineer in the last 5 years"),
            "software engineer",
        );
        assert.equal(
            extractClaimedCurrentRole("hi my name is gal kosocer and in the last 5 years im software developer"),
            "software developer",
        );
        assert.equal(
            extractClaimedCurrentRole("hi my name is gal kosover and in the last 5 years im qa"),
            "qa",
        );
        assert.equal(
            extractClaimedCurrentRole("i did manual qa for 3 years"),
            "manual qa",
        );
        assert.equal(
            extractClaimedCurrentRole("show me jobs for automation qa engineer"),
            "automation qa engineer",
        );
    });

    it("detects QA CV vs software engineer chat conflict", () => {
        assert.equal(
            rolesConflict("QA Automation & Performance Engineer at IDF - Lotem Unit", "software engineer"),
            true,
        );
        assert.equal(rolesConflict("Software Engineer", "software engineer"), false);
    });

    it("filters QA-linked skills and achievements", () => {
        assert.deepEqual(
            filterOutQaLinkedSkills(["TypeScript", "Selenium", "React", "JMeter"]),
            ["TypeScript", "React"],
        );
        assert.deepEqual(
            filterOutQaLinkedAchievements([
                { name: "Built React apps", grade: 80 },
                { name: "QA automation for Lotem", grade: 90 },
            ]),
            [{ name: "Built React apps", grade: 80 }],
        );
    });

    it("recognizes chat-preferred conflict resolutions", () => {
        assert.equal(isChatRolePreferredResolution("software engineer", "software engineer"), true);
        assert.equal(isChatRolePreferredResolution("not QA", "software engineer"), true);
        assert.equal(isChatRolePreferredResolution("keep the CV", "software engineer"), false);
    });
});
