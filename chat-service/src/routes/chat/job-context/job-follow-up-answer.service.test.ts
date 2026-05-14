import { describe, expect, it } from "vitest";
import { JobFollowUpAnswerService } from "./job-follow-up-answer.service";
import type { SanitizedJob } from "./job-context.types";
import { createEmptyProfileSignals } from "../../career-profile/career-profile.utils";
import type { UserCareerProfile } from "../../career-profile/career-profile.types";

const job: SanitizedJob = {
    id: "1",
    title: "Full Stack Developer",
    company: "Fiverr",
    seniority: "junior",
    description: "Build React and Node APIs with MongoDB.",
    requirements: ["React", "Node.js", "MongoDB"],
    mustKnowSkills: ["React", "Node.js"],
    niceToHaveSkills: ["TypeScript"],
    benefits: ["Health insurance"],
    salary: 12000,
    location: null,
    url: "https://example.com/job/1",
};

const buildProfile = (): UserCareerProfile => ({
    userId: "u1",
    ...createEmptyProfileSignals(),
    salaryExpectation: null,
    locationPreference: null,
    remotePreference: null,
    senioritySignal: "junior",
    uncertaintyLevel: 0.2,
    profileSummaryText: "",
    profileSummaryEmbedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    technologies: [{ value: "React", confidence: 0.9, evidence: ["msg"], source: "chat", updatedAt: new Date() }],
    interests: [],
    workStyle: [],
});

describe("JobFollowUpAnswerService", () => {
    const service = new JobFollowUpAnswerService();

    it("returns must-know skills from job context", () => {
        const reply = service.buildAnswer("mustKnowSkills", job, "what is the mustKnowSkills?", buildProfile());
        expect(reply).toContain("must-know skills");
        expect(reply).toContain("React");
    });

    it("returns missing data message when salary is not available", () => {
        const reply = service.buildAnswer("salary", { ...job, salary: null }, "what is the salary?", buildProfile());
        expect(reply).toContain("I do not have salary");
    });
});
