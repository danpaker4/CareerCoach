import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONVERSATION_MODE } from "../mode-detection/conversation-mode.consts";
import { detectModeDeterministically } from "../mode-detection/deterministic-mode.utils";

describe("deterministic mode detection", () => {
    it("reads an explicit request for jobs as near term", () => {
        for (const message of [
            "find me react jobs now",
            "show me jobs for automation qa engineer",
            "find jobs now for junior frontend developer remote",
            "i have 3 years react and typescript, search now for mid level roles",
            "skip to jobs for devops engineer with terraform",
            "show me jobs for qa manual tester in tel aviv",
            "find jobs now for senior product manager b2b",
            "I want a QA job in Tel Aviv",
            "senior product manager roles please",
        ]) {
            assert.equal(
                detectModeDeterministically(message)?.mode,
                CONVERSATION_MODE.NEAR_TERM,
                `expected NEAR_TERM for "${message}"`
            );
        }
    });

    it("extracts the role from a near-term request", () => {
        assert.equal(detectModeDeterministically("find me react jobs now")?.target, "react");
        assert.equal(detectModeDeterministically("I want a QA job in Tel Aviv")?.target, "QA");
    });

    it("reads a stated long-term goal as dream job", () => {
        for (const message of [
            "I want to become a CTO in 5 years",
            "my dream job is to be an engineering director",
            "my dream job long term is to build my own company",
            "where i want to be in 10 years is leading AI research at a top lab",
            "eventually I want to become a founder",
        ]) {
            assert.equal(
                detectModeDeterministically(message)?.mode,
                CONVERSATION_MODE.DREAMJOB,
                `expected DREAMJOB for "${message}"`
            );
        }
    });

    it("extracts the target role from a dream-job statement", () => {
        assert.equal(detectModeDeterministically("I want to become a CTO in 5 years")?.target, "CTO");
    });

    it("prefers the long-term reading when the message names a horizon", () => {
        assert.equal(
            detectModeDeterministically("I want to be a staff engineer in 3 years")?.mode,
            CONVERSATION_MODE.DREAMJOB
        );
    });

    it("generalises past the phrasings the evaluation fixtures happen to use", () => {
        for (const message of [
            "can you get me openings for a data engineer",
            "I'd like a devops position",
            "list the current openings for security analyst",
        ]) {
            assert.equal(
                detectModeDeterministically(message)?.mode,
                CONVERSATION_MODE.NEAR_TERM,
                `expected NEAR_TERM for "${message}"`
            );
        }
        for (const message of [
            "one day I want to be a principal architect",
            "I aspire to become a head of data",
        ]) {
            assert.equal(
                detectModeDeterministically(message)?.mode,
                CONVERSATION_MODE.DREAMJOB,
                `expected DREAMJOB for "${message}"`
            );
        }
    });

    it("leaves an ambiguous message to the model", () => {
        for (const message of [
            "I feel stuck in my career",
            "what should I learn next?",
            "i need to change jobs",
            "what certifications matter for cloud work?",
            "is my CV any good?",
            "hello",
            "",
        ]) {
            assert.equal(detectModeDeterministically(message), null, `expected null for "${message}"`);
        }
    });
});
