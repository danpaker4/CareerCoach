/** Must stay in sync with chat-service `ConversationMode`. */
export const CONVERSATION_MODES = ["FAST_SEARCH", "GUIDED", "DEEP_DISCOVERY"] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];
