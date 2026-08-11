import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONVERSATION_MODE, DEFAULT_MODE_DETECTION_RESULT } from "../conversation-mode.consts";
import {
    applyDreamJobPivotOverride,
    applyModePivotOverrides,
    applyNearTermPivotOverride,
    extractNearTermSearchQuery,
    isDreamJobPivotMessage,
    isNearTermPivotMessage,
    isUndecidedDirectionMessage,
} from "../conversation-mode.pivot.utils";

describe("dream job pivot detection", () => {
    it("detects explicit dream-job preference phrases", () => {
        assert.equal(isDreamJobPivotMessage("i prefer to talk about my dream job"), true);
        assert.equal(isDreamJobPivotMessage("let's talk about my dream job"), true);
        assert.equal(isDreamJobPivotMessage("I'm thinking about the future"), true);
        assert.equal(isDreamJobPivotMessage("I want a long-term career path"), true);
        assert.equal(isDreamJobPivotMessage("hi my name is gal"), false);
    });

    it("overrides non-dream modes to DREAMJOB", () => {
        const overridden = applyDreamJobPivotOverride(
            { ...DEFAULT_MODE_DETECTION_RESULT, mode: CONVERSATION_MODE.NEAR_TERM, shouldSearchJobs: true },
            "I prefer to talk about my dream job",
        );
        assert.equal(overridden.mode, CONVERSATION_MODE.DREAMJOB);
        assert.equal(overridden.shouldSearchJobs, false);
    });
});

describe("near-term pivot detection", () => {
    it("detects looking-for-a-job-now phrases", () => {
        assert.equal(isNearTermPivotMessage("im looking for a job now as a software developer"), true);
        assert.equal(isNearTermPivotMessage("I need a job soon"), true);
        assert.equal(isNearTermPivotMessage("something for now"), true);
        assert.equal(isNearTermPivotMessage("i prefer to talk about my dream job"), false);
    });

    it("extracts the target role from near-term requests", () => {
        assert.equal(
            extractNearTermSearchQuery("im looking for a job now as a software developer"),
            "software developer",
        );
    });

    it("overrides dream/guided modes to NEAR_TERM with search enabled", () => {
        const overridden = applyNearTermPivotOverride(
            { ...DEFAULT_MODE_DETECTION_RESULT, mode: CONVERSATION_MODE.DREAMJOB },
            "im looking for a job now as a software developer",
        );
        assert.equal(overridden.mode, CONVERSATION_MODE.NEAR_TERM);
        assert.equal(overridden.shouldSearchJobs, true);
        assert.equal(overridden.searchQuery, "software developer");
    });

    it("lets near-term win over dream-job in combined overrides", () => {
        const overridden = applyModePivotOverrides(
            { ...DEFAULT_MODE_DETECTION_RESULT, mode: CONVERSATION_MODE.GUIDED },
            "im looking for a job now as a software developer",
        );
        assert.equal(overridden.mode, CONVERSATION_MODE.NEAR_TERM);
        assert.equal(overridden.shouldSearchJobs, true);
    });
});

describe("undecided direction detection", () => {
    it("detects undecided fork answers", () => {
        assert.equal(isUndecidedDirectionMessage("i don't know"), true);
        assert.equal(isUndecidedDirectionMessage("I'm not sure"), true);
        assert.equal(isUndecidedDirectionMessage("still figuring out"), true);
        assert.equal(isUndecidedDirectionMessage("looking for a job now"), false);
    });

    it("does not force near-term or dream-job for undecided answers", () => {
        assert.equal(isNearTermPivotMessage("i don't know"), false);
        assert.equal(isDreamJobPivotMessage("i don't know"), false);

        const overridden = applyModePivotOverrides(
            {
                ...DEFAULT_MODE_DETECTION_RESULT,
                mode: CONVERSATION_MODE.NEAR_TERM,
                shouldSearchJobs: true,
                searchQuery: "software developer",
            },
            "i don't know",
        );
        assert.equal(overridden.mode, CONVERSATION_MODE.GUIDED);
        assert.equal(overridden.shouldSearchJobs, false);
        assert.equal(overridden.searchQuery, undefined);
    });

    it("routes future fork answers to dream-job via combined overrides", () => {
        const overridden = applyModePivotOverrides(
            { ...DEFAULT_MODE_DETECTION_RESULT, mode: CONVERSATION_MODE.GUIDED },
            "I'm thinking about the future",
        );
        assert.equal(overridden.mode, CONVERSATION_MODE.DREAMJOB);
        assert.equal(overridden.shouldSearchJobs, false);
    });
});
