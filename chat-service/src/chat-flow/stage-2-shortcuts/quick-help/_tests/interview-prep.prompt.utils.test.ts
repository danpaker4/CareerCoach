import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildInterviewGradePrompt,
    buildInterviewQuestionsPrompt,
} from "../interview-prep/interview-prep.prompt.utils";

describe("buildInterviewGradePrompt", () => {
    it("requests a hidden numeric score with outcome-aligned bands", () => {
        const prompt = buildInterviewGradePrompt({
            topic: "QA automation",
            question: "What makes an automated test reliable?",
            answer: "It should be deterministic and isolated.",
        });

        assert.match(prompt, /score.*0.*100/is);
        assert.match(prompt, /correct.*80.*100/is);
        assert.match(prompt, /partially_correct.*50.*79/is);
        assert.match(prompt, /needs_teaching.*score.*0/is);
    });

    it("gives the LLM an explicit teaching-only instruction when the candidate does not know", () => {
        const prompt = buildInterviewGradePrompt({
            topic: "Problem-Solving Strategies for software engineer",
            question: "What is the difference between top-down and bottom-up problem-solving?",
            answer: "i dont know that",
        });

        assert.match(prompt, /knowledge gap has already been detected/i);
        assert.match(prompt, /outcome must be "needs_teaching"/i);
        assert.match(prompt, /do not praise/i);
        assert.match(prompt, /"outcome": "needs_teaching"/i);
        assert.doesNotMatch(prompt, /your scaling example/i);
    });

    it("does not force teaching mode for a substantive candidate answer", () => {
        const prompt = buildInterviewGradePrompt({
            topic: "software architecture",
            question: "When would you choose microservices?",
            answer: "I would choose them when services need to scale independently.",
        });

        assert.doesNotMatch(prompt, /knowledge gap has already been detected/i);
        assert.match(prompt, /"outcome": "partially_correct"/i);
    });
});

describe("buildInterviewQuestionsPrompt", () => {
    it("requests one non-repeated question at the selected difficulty", () => {
        const prompt = buildInterviewQuestionsPrompt({
            topic: "QA automation",
            difficulty: "easy",
            previousQuestions: ["What is a flaky test?"],
        });

        assert.match(prompt, /Create 1 interview practice question/i);
        assert.match(prompt, /Difficulty: easy/i);
        assert.match(prompt, /What is a flaky test/i);
        assert.match(prompt, /must not repeat/i);
    });
});
