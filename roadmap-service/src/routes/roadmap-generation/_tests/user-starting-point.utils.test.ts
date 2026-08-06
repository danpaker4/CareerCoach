import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    extractUserSkills,
    hasSubstantialCareerBackground,
    resolveUserStartingPoint,
} from "../user-starting-point.utils";

describe("user-starting-point.utils", () => {
    it("treats users without skills or CV as high-school entry level", () => {
        const startingPoint = resolveUserStartingPoint(null, {
            senioritySignal: "mid",
            preferredRoles: ["Cyber Security Analyst"],
            longTermGoals: [],
            preferredDomains: ["cyber security"],
            softSkills: [],
            technologies: [],
        });

        assert.equal(startingPoint.isEntryLevel, true);
        assert.equal(startingPoint.roleExperienceLevel, "entry");
        assert.equal(startingPoint.roleExperienceYears, 0);
        assert.equal(startingPoint.userSkills.length, 0);
        assert.match(startingPoint.currentRoleSummary, /high school/i);
    });

    it("uses GitHub skills even without professional experience", () => {
        const startingPoint = resolveUserStartingPoint(
            {
                githubUrl: "https://github.com/example",
                githubSkills: ["TypeScript", "React", "Node.js"],
            },
            null
        );

        assert.equal(startingPoint.isEntryLevel, true);
        assert.equal(startingPoint.userSkills.length, 3);
        assert.ok(startingPoint.userSkills.includes("TypeScript"));
        assert.match(startingPoint.currentRoleSummary, /GitHub/i);
        assert.doesNotMatch(startingPoint.currentRoleSummary, /no professional experience, skills, or CV/i);
    });

    it("ignores github project count pseudo-skills", () => {
        const skills = extractUserSkills(
            { githubSkills: ["TypeScript", "3 github projects"] },
            null,
            false
        );

        assert.deepEqual(skills, ["TypeScript"]);
    });

    it("uses explicit profile data when available", () => {
        const startingPoint = resolveUserStartingPoint(
            {
                currentJob: "Junior Developer",
                technologies: ["TypeScript"],
                roleExperience: [{ displayLabel: "Developer", years: 2, level: "junior", evidence: ["Built APIs"] }],
            },
            null
        );

        assert.equal(startingPoint.isEntryLevel, false);
        assert.equal(startingPoint.currentJob, "Junior Developer");
        assert.equal(startingPoint.roleExperienceLevel, "junior");
        assert.ok(startingPoint.userSkills.includes("TypeScript"));
        assert.match(startingPoint.currentRoleSummary, /Junior Developer/);
        assert.match(startingPoint.currentRoleSummary, /TypeScript/);
    });

    it("includes skills when CV is on file but current job is missing", () => {
        const startingPoint = resolveUserStartingPoint(
            {
                cv: "s3://careercoach/cvs/user-123.pdf",
                cvText: "Software engineer with experience in Python, AWS, and security operations.",
                technologies: ["Python", "AWS", "SIEM", "Python", "Linux"],
                knownSkills: ["Incident Response", "Threat Hunting"],
            },
            null
        );

        assert.equal(startingPoint.isEntryLevel, false);
        assert.equal(startingPoint.currentJob, "Not specified");
        assert.ok(startingPoint.userSkills.includes("Python"));
        assert.ok(startingPoint.userSkills.includes("Incident Response"));
        assert.match(startingPoint.currentRoleSummary, /skills include/i);
        assert.match(startingPoint.currentRoleSummary, /Python/);
        assert.doesNotMatch(startingPoint.currentRoleSummary, /^Early-career professional with CV on file$/);
    });

    it("does not count coach seniority alone as substantial background", () => {
        assert.equal(
            hasSubstantialCareerBackground(null, {
                senioritySignal: "mid",
                preferredRoles: [],
                longTermGoals: [],
                preferredDomains: ["cyber"],
                softSkills: [],
                technologies: [],
            }),
            false
        );
    });
});
