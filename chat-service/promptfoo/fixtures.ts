import type { Conversation } from "../src/routes/conversation/conversation.model";
import type { ConversationStage } from "../src/routes/conversation/conversation.stage.consts";
import { CONVERSATION_STAGES } from "../src/routes/conversation/conversation.stage.consts";

export const EMPTY_ACHIEVEMENTS = [] as const;

export const FIXTURE_CONVERSATION: Conversation = {
    userId: "promptfoo-user",
    messages: [
        {
            role: "user",
            content: "Hi, I want help with my career.",
            timestamp: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
            role: "assistant",
            content: "Happy to help. What kind of roles interest you?",
            timestamp: new Date("2026-01-01T00:00:01.000Z"),
        },
    ],
    stageProgress: {
        currentStageIndex: 0,
        awaitingConfirmation: false,
        stageNotes: {},
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:01.000Z"),
};

export const FIXTURE_STAGE: ConversationStage = CONVERSATION_STAGES[0];

export const FIXTURE_USER_ACCOUNT_CONTEXT = `
Profile summary: Software engineer with TypeScript and React experience.
Skills: TypeScript, React, Node.js, Git.
`.trim();
