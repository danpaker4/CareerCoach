/** Must stay in sync with chat-service `CONVERSATION_STAGES` order and ids. */
export const CONVERSATION_STAGE_IDS = ["achievements", "timeline", "preferences"] as const;

export type ConversationStageId = (typeof CONVERSATION_STAGE_IDS)[number];
