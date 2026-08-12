import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    calculateInterviewAverage,
    difficultyForInterviewAverage,
    mapInterviewYearsToDifficulty,
    normalizeInterviewScore,
    parseInterviewExperienceYears,
    resolveInterviewDifficulty,
} from "../interview-prep/interview-prep.utils";

describe("interview prep difficulty", () => {
    it("enforces score bands and safe fallbacks", () => {
        assert.equal(normalizeInterviewScore("correct", 95), 95);
        assert.equal(normalizeInterviewScore("correct", 20), 90);
        assert.equal(normalizeInterviewScore("partially_correct", 65), 65);
        assert.equal(normalizeInterviewScore("partially_correct", undefined), 65);
        assert.equal(normalizeInterviewScore("incorrect", 30), 30);
        assert.equal(normalizeInterviewScore("incorrect", 80), 25);
        assert.equal(normalizeInterviewScore("needs_teaching", 100), 0);
    });

    it("averages attempts and maps the running average to difficulty", () => {
        assert.equal(calculateInterviewAverage([30, 80]), 55);
        assert.equal(difficultyForInterviewAverage(49), "easy");
        assert.equal(difficultyForInterviewAverage(50), "medium");
        assert.equal(difficultyForInterviewAverage(79), "medium");
        assert.equal(difficultyForInterviewAverage(80), "hard");
    });

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
