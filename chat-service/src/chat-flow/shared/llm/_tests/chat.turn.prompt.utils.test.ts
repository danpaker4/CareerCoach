import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
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
});
