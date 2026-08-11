import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONVERSATION_STAGES, STAGE_SIGNALS } from "../conversation.stage.consts";
import { getCurrentStage, getInitialAssistantMessage } from "../conversation.stage.utils";
import type { Conversation } from "../conversation.model";
import { defaultOnboardingFlow } from "../conversation.utils";

const conversationWithProgress = (
    completedStageIds: string[],
    currentStageId?: string,
    onboardingCompleted = true,
): Conversation => ({
    userId: "stage-test-user",
    messages: [],
    stageProgress: {
        currentStageIndex: completedStageIds.length,
        currentStageId,
        completedStageIds,
        awaitingConfirmation: false,
        stageNotes: {},
    },
    onboardingFlow: {
        ...defaultOnboardingFlow(),
        completed: onboardingCompleted,
        backgroundResolved: onboardingCompleted,
        directionResolved: onboardingCompleted,
    },
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
});

describe("guided stage objectives", () => {
    it("defers background and direction to onboarding and keeps discovery for undecided", () => {
        const [background, direction, discovery] = CONVERSATION_STAGES;
        assert.equal(background?.id, "achievements");
        assert.match(background?.objective ?? "", /handled by onboarding/i);
        assert.equal(direction?.id, "timeline");
        assert.match(direction?.objective ?? "", /handled by onboarding/i);
        assert.equal(discovery?.id, "preferences");
        assert.match(discovery?.objective ?? "", /Only when the user is undecided/i);
    });

    it("does not treat tenure years as a timeline signal", () => {
        assert.equal(STAGE_SIGNALS.timeline.includes("years"), false);
        assert.equal(STAGE_SIGNALS.achievements.includes("years"), true);
    });
});

describe("getInitialAssistantMessage", () => {
    it("asks for professional background only", () => {
        const opening = getInitialAssistantMessage();
        assert.match(opening, /professional background/i);
        assert.doesNotMatch(opening, /interested in lately/i);
    });

    it("personalizes with firstName when provided", () => {
        assert.match(getInitialAssistantMessage("Gal"), /^Hi Gal,/);
    });
});

describe("getCurrentStage sequential inference", () => {
    it("ignores keyword stage jumps while onboarding is incomplete", () => {
        const conversation = conversationWithProgress([], "achievements", false);
        assert.equal(getCurrentStage(conversation, "i love to solve problem and think")?.id, "achievements");
        assert.equal(getCurrentStage(conversation, "i don't know")?.id, "achievements");
    });

    it("allows discovery signals only after the direction fork stage is complete", () => {
        const beforeFork = conversationWithProgress(["achievements"], "timeline");
        assert.equal(getCurrentStage(beforeFork, "i love solving problems")?.id, "timeline");

        const afterFork = conversationWithProgress(["achievements", "timeline"], "preferences");
        assert.equal(getCurrentStage(afterFork, "i love solving problems")?.id, "preferences");
    });
});
