import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    mapInterviewYearsToDifficulty,
    parseInterviewExperienceYears,
    resolveInterviewDifficulty,
} from "../interview-prep/interview-prep.utils";

describe("interview prep difficulty", () => {
    it("maps the agreed experience boundaries", () => {
        assert.equal(mapInterviewYearsToDifficulty(1.5), "easy");
        assert.equal(mapInterviewYearsToDifficulty(2), "medium");
        assert.equal(mapInterviewYearsToDifficulty(10), "medium");
        assert.equal(mapInterviewYearsToDifficulty(11), "hard");
    });

    it("parses integer and decimal experience replies", () => {
        assert.equal(parseInterviewExperienceYears("I have 1.5 years"), 1.5);
        assert.equal(parseInterviewExperienceYears("11 years"), 11);
        assert.equal(mapInterviewYearsToDifficulty(parseInterviewExperienceYears("more than 10 years") ?? 0), "hard");
        assert.equal(mapInterviewYearsToDifficulty(parseInterviewExperienceYears("less than 2 years") ?? 2), "easy");
        assert.equal(parseInterviewExperienceYears("I am not sure"), undefined);
    });

    it("uses only matching compound-role experience and lets explicit difficulty win", () => {
        const roleExperience = [{
            roleKey: "qa-automation-performance-engineer",
            displayLabel: "QA Automation & Performance Engineer",
            years: 2,
            level: "mid" as const,
            evidence: ["test"],
            source: "chat" as const,
            updatedAt: new Date(),
        }];

        assert.equal(resolveInterviewDifficulty("QA automation", roleExperience), "medium");
        assert.equal(resolveInterviewDifficulty("QA automation, advanced", roleExperience), "hard");
        assert.equal(resolveInterviewDifficulty("React", roleExperience), undefined);
    });
});
