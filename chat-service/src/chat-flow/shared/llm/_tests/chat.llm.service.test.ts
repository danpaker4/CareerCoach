import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ObjectId } from "mongodb";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { ChatFlowDeps, SendMessageBaseContext } from "../../../chat-flow.types";
import type { ChatLlmParseEvent } from "../chat.llm.types";
import { decideNextStep } from "../chat.llm.service";
import { LLM_DECISION_PARSE_FALLBACK_REPLY } from "../chat.llm.consts";

const createConversation = (): Conversation => ({
    _id: new ObjectId(),
    userId: "parse-test-user",
    messages: [{ role: "user", content: "I enjoy backend work.", timestamp: new Date(0) }],
    stageProgress: {
        currentStageIndex: 0,
        awaitingConfirmation: false,
        stageNotes: {},
    },
    createdAt: new Date(0),
    updatedAt: new Date(0),
});

describe("decideNextStep parse observability", () => {
    it("records a diagnosable parse failure before returning the safe fallback", async () => {
        const conversation = createConversation();
        const parseEvents: ChatLlmParseEvent[] = [];
        const deps = {
            textCompletion: {
                complete: async () => "This is not JSON.",
            },
            llmObserver: {
                recordParseEvent: (event: ChatLlmParseEvent) => {
                    parseEvents.push(event);
                },
            },
        } as unknown as ChatFlowDeps;
        const context = {
            normalizedMessage: "I enjoy backend work.",
            userAchievements: [],
            userAccountContext: "",
            conversationAfterUserMessage: conversation,
        } as unknown as SendMessageBaseContext;

        const decision = await decideNextStep(deps, context);

        assert.equal(decision.reply, LLM_DECISION_PARSE_FALLBACK_REPLY);
        assert.equal(parseEvents.length, 1);
        assert.equal(parseEvents[0]?.parseStatus, "fallback");
        assert.equal(parseEvents[0]?.userId, conversation.userId);
        assert.match(parseEvents[0]?.errorMessage ?? "", /invalid JSON decision payload/);
    });
});
