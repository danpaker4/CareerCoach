import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    detectQuickHelpExitIntent,
    detectQuickHelpIntent,
    modeForQuickHelpFlow,
} from "../shared/quick-help.utils";
import {
    isAllowedSpokenInterviewQuestion,
    isInterviewFeedbackChallenge,
} from "../interview-prep/interview-prep.utils";
import { buildProfileJobSearchQuery } from "../profile-job-match/profile-job-match.utils";

describe("detectQuickHelpIntent", () => {
    it("detects the quick prompt phrases", () => {
        assert.equal(detectQuickHelpIntent("What skills should I learn for my next role?"), "skills_gap");
        assert.equal(detectQuickHelpIntent("Suggest jobs that match my profile"), "profile_job_match");
        assert.equal(detectQuickHelpIntent("How can I improve my CV?"), "cv_improve");
        assert.equal(detectQuickHelpIntent("Help me prepare for interviews"), "interview_prep");
    });

    it("returns null for unrelated messages", () => {
        assert.equal(detectQuickHelpIntent("hello there"), null);
    });
});

describe("detectQuickHelpExitIntent", () => {
    it("detects exit phrases", () => {
        assert.equal(detectQuickHelpExitIntent("let's talk about something else"), true);
        assert.equal(detectQuickHelpExitIntent("stop"), true);
        assert.equal(detectQuickHelpExitIntent("I want to ask about something else"), true);
    });

    it("ignores normal answers", () => {
        assert.equal(detectQuickHelpExitIntent("Frontend Engineer"), false);
        assert.equal(detectQuickHelpExitIntent("got it"), false);
        assert.equal(detectQuickHelpExitIntent("I want to ask about React"), false);
    });
});

describe("modeForQuickHelpFlow", () => {
    it("maps flow kinds to sticky modes", () => {
        assert.equal(modeForQuickHelpFlow({ kind: "skills_gap", step: "awaiting_role" }), "SKILLS_GAP");
        assert.equal(modeForQuickHelpFlow({ kind: "cv_improve", step: "awaiting_cv_or_proceed" }), "CV_IMPROVE");
        assert.equal(
            modeForQuickHelpFlow({ kind: "interview_prep", step: "awaiting_topic" }),
            "INTERVIEW_PREP"
        );
        assert.equal(modeForQuickHelpFlow(undefined), undefined);
    });
});

describe("buildProfileJobSearchQuery", () => {
    it("joins skills and achievements", () => {
        const query = buildProfileJobSearchQuery({
            profile: { knownSkills: ["React"], technologies: ["TypeScript"], currentJob: "QA" },
            userAchievements: [{ id: "1", name: "Cypress", grade: 4 }],
        });
        assert.match(query, /react/i);
        assert.match(query, /typescript/i);
    });
});

describe("interview prep message detection", () => {
    it("detects challenges to interview feedback", () => {
        assert.equal(isInterviewFeedbackChallenge("that's what I said"), true);
        assert.equal(isInterviewFeedbackChallenge("Why was I wrong?"), true);
        assert.equal(isInterviewFeedbackChallenge("Here is a clearer answer"), false);
    });

    it("rejects coding and drawing requests from generated interview questions", () => {
        assert.equal(isAllowedSpokenInterviewQuestion("Explain the tradeoff verbally."), true);
        assert.equal(isAllowedSpokenInterviewQuestion("Write code for a cache."), false);
        assert.equal(isAllowedSpokenInterviewQuestion("Draw a system design diagram."), false);
    });
});
