import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import { CONVERSATION_STAGES } from "../../../../routes/conversation/conversation.stage.consts";
import { buildTurnDecisionPrompt } from "../chat.turn.prompt.utils";

describe("buildTurnDecisionPrompt", () => {
    it("includes the latest saved user message once and keeps six prior messages", () => {
        const latestUserMessage = "LATEST_USER_MESSAGE_UNIQUE";
        const priorMessages = Array.from({ length: 7 }, (_, index) => ({
            role: index % 2 === 0 ? "user" as const : "assistant" as const,
            content: `prior-message-${index + 1}`,
            timestamp: new Date(2026, 0, index + 1),
        }));
        const conversation: Conversation = {
            userId: "prompt-test-user",
            messages: [
                ...priorMessages,
                {
                    role: "user",
                    content: latestUserMessage,
                    timestamp: new Date(2026, 0, 8),
                },
            ],
            stageProgress: {
                currentStageIndex: 0,
                awaitingConfirmation: false,
                stageNotes: {},
            },
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 8),
        };

        const prompt = buildTurnDecisionPrompt(conversation, latestUserMessage, [], "account context");
        const recentHistory = prompt
            .split("Recent conversation:\n")[1]
            ?.split("\nLatest:")[0];
        const latestMessageOccurrences = prompt.split(latestUserMessage).length - 1;

        assert.equal(latestMessageOccurrences, 1);
        assert.equal(recentHistory?.split("\n").length, 6);
        assert.doesNotMatch(recentHistory ?? "", /prior-message-1/);
        assert.match(recentHistory ?? "", /prior-message-2/);
        assert.match(prompt, new RegExp(`Latest: ${latestUserMessage}`));
    });

    it("tells the model onboarding already handled background and direction", () => {
        const conversation: Conversation = {
            userId: "prompt-test-user",
            messages: [],
            stageProgress: {
                currentStageIndex: 0,
                awaitingConfirmation: false,
                stageNotes: {},
            },
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 1),
        };
        const preferencesStage = CONVERSATION_STAGES.find((stage) => stage.id === "preferences");
        const prompt = buildTurnDecisionPrompt(
            conversation,
            "i love to solve problem and think",
            [],
            "Current role: software developer",
            preferencesStage,
        );

        assert.match(prompt, /onboarding already ran/i);
        assert.match(prompt, /Do not re-ask for professional background/i);
        assert.match(prompt, /Guided objective: ".*Only when the user is undecided/i);
        assert.match(prompt, /choosing, adding, rejecting, or clarifying among jobs already listed/i);
        assert.match(prompt, /set search=false/i);
    });

    it("makes the latest explicit chat value authoritative over stored profile data", () => {
        const conversation: Conversation = {
            userId: "prompt-test-user",
            messages: [],
            onboardingFlow: {
                started: true,
                backgroundResolved: true,
                backgroundAskCount: 0,
                directionResolved: true,
                directionAskCount: 0,
                completed: true,
                background: {
                    status: "FOUND",
                    role: "software developer",
                    yearsOfExperience: 5,
                },
            },
            stageProgress: {
                currentStageIndex: 0,
                awaitingConfirmation: false,
                stageNotes: {},
            },
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 1),
        };
        const prompt = buildTurnDecisionPrompt(
            conversation,
            "I have been a software developer for five years",
            [],
            "Current role / headline: QA Automation Engineer",
        );

        assert.match(prompt, /User chat is the source of truth/i);
        assert.match(prompt, /use only the latest chat value/i);
        assert.match(prompt, /do not ask the user to choose between sources/i);
        assert.match(prompt, /Resolved conversation background \(authoritative over conflicting Account\/CV values\)/i);
        assert.match(prompt, /"role":"software developer","yearsOfExperience":5/);
    });
});
