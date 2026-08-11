import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { needsOnboarding, defaultOnboardingFlow } from "../../../../routes/conversation/conversation.utils";
import type { Conversation } from "../../../../routes/conversation/conversation.model";

const baseConversation = (onboardingFlow?: Conversation["onboardingFlow"]): Conversation => ({
    userId: "u1",
    messages: [],
    stageProgress: {
        currentStageIndex: 0,
        awaitingConfirmation: false,
        stageNotes: {},
    },
    onboardingFlow,
    createdAt: new Date(0),
    updatedAt: new Date(0),
});

describe("needsOnboarding", () => {
    it("is false for legacy conversations without onboardingFlow", () => {
        assert.equal(needsOnboarding(baseConversation(undefined)), false);
    });

    it("is true while onboarding is incomplete", () => {
        assert.equal(needsOnboarding(baseConversation(defaultOnboardingFlow())), true);
    });

    it("is false after onboarding completed", () => {
        assert.equal(
            needsOnboarding(baseConversation({
                ...defaultOnboardingFlow(),
                completed: true,
                backgroundResolved: true,
                directionResolved: true,
                initialMode: "GUIDED",
            })),
            false,
        );
    });
});
