/** Must stay in sync with chat-service `ConversationMode`. */
export const CONVERSATION_MODES = ["DREAMJOB", "NEAR_TERM", "GUIDED"] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];
