import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONVERSATION_MODE, DEFAULT_MODE_DETECTION_RESULT } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import type { ChatTurnDecision } from "../../api/shared/chat.types";
import {
    applyBackgroundRoleForkOverride,
    buildDirectionForkReply,
} from "../background-role-fork.utils";

const baseDecision = (reply: string): ChatTurnDecision => ({
    reply,
    shouldSearchJobs: false,
    recommendedJobIds: [],
    searchFilters: { skills: [], interests: [], experienceLevel: "", keywords: [] },
    modeDetection: { ...DEFAULT_MODE_DETECTION_RESULT, mode: CONVERSATION_MODE.GUIDED },
    shouldAdvanceStage: false,
});

describe("background role fork override", () => {
    it("builds the direction fork from a stated role", () => {
        assert.equal(
            buildDirectionForkReply("software developer"),
            "I see that you are a software developer — what are you looking for now?",
        );
    });

    it("forces the fork after a clear background role on achievements stage", () => {
        const overridden = applyBackgroundRoleForkOverride(
            baseDecision("What's your current job or role, Gal?"),
            "hi my name is gal kosocer and in the last 5 years im software developer",
            "achievements",
        );
        assert.equal(
            overridden.reply,
            "I see that you are a software developer — what are you looking for now?",
        );
        assert.equal(overridden.shouldAdvanceStage, true);
        assert.equal(overridden.shouldSearchJobs, false);
    });

    it("does not override when the user already picked near-term", () => {
        const overridden = applyBackgroundRoleForkOverride(
            baseDecision("Let me find roles for you."),
            "im looking for a job now as a software developer",
            "achievements",
        );
        assert.equal(overridden.reply, "Let me find roles for you.");
        assert.equal(overridden.shouldAdvanceStage, false);
    });

    it("does not override outside the background stage", () => {
        const overridden = applyBackgroundRoleForkOverride(
            baseDecision("What do you enjoy most about your work?"),
            "im software developer",
            "preferences",
        );
        assert.equal(overridden.reply, "What do you enjoy most about your work?");
    });
});
