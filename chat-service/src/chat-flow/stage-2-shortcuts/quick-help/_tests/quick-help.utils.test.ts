import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    detectQuickHelpExitIntent,
    detectQuickHelpIntent,
    modeForQuickHelpFlow,
} from "../shared/quick-help.utils";
import { isInterviewAckMessage, isClearlyInsufficientInterviewAnswer } from "../interview-prep/interview-prep.utils";
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

describe("isInterviewAckMessage", () => {
    it("accepts common acknowledgements", () => {
        assert.equal(isInterviewAckMessage("got it"), true);
        assert.equal(isInterviewAckMessage("I understand"), true);
        assert.equal(isInterviewAckMessage("no more questions"), true);
    });
});

describe("isClearlyInsufficientInterviewAnswer", () => {
    it("rejects thin or placeholder answers", () => {
        assert.equal(isClearlyInsufficientInterviewAnswer("idk"), true);
        assert.equal(isClearlyInsufficientInterviewAnswer("no idea"), true);
        assert.equal(isClearlyInsufficientInterviewAnswer("yes"), true);
        assert.equal(isClearlyInsufficientInterviewAnswer("asdf"), true);
    });

    it("allows substantive answers through to the grader", () => {
        assert.equal(
            isClearlyInsufficientInterviewAnswer("React is a UI library that uses a component tree and a virtual DOM."),
            false
        );
    });
});

describe("detectQuickHelpIntent on wording people actually type", () => {
    it("reads a skills gap that is described rather than named", () => {
        assert.equal(detectQuickHelpIntent("what am I missing to move into platform engineering?"), "skills_gap");
        assert.equal(detectQuickHelpIntent("what do I need to learn to get there?"), "skills_gap");
    });

    it("reads CV help beyond the word improve", () => {
        assert.equal(detectQuickHelpIntent("can you help me rewrite my cv?"), "cv_improve");
        assert.equal(
            detectQuickHelpIntent("how do I phrase a bullet about leading a migration on my resume?"),
            "cv_improve"
        );
    });

    it("reads interview help from the situation, not just the word prep", () => {
        assert.equal(
            detectQuickHelpIntent("I have an interview on Thursday and I'm nervous about the system design round"),
            "interview_prep"
        );
        assert.equal(detectQuickHelpIntent("how should I answer behavioural questions?"), "interview_prep");
    });

    it("leaves an unrelated message alone", () => {
        assert.equal(detectQuickHelpIntent("show me openings for a frontend developer"), null);
        assert.equal(detectQuickHelpIntent("add the second one to my pipeline"), null);
    });
});
