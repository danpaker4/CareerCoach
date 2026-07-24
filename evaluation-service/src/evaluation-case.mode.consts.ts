/** Must stay in sync with chat-service `ConversationMode`. */
export const CONVERSATION_MODES = ["DREAMJOB", "NEAR_TERM", "GUIDED"] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

/** Legacy evaluation modes stored before the DREAMJOB / NEAR_TERM / GUIDED rename. */
export const LEGACY_CONVERSATION_MODE_MAP = {
    FAST_SEARCH: "NEAR_TERM",
    DEEP_DISCOVERY: "GUIDED",
} as const satisfies Record<string, ConversationMode>;

export const isConversationMode = (value: string): value is ConversationMode =>
    (CONVERSATION_MODES as readonly string[]).includes(value);

export const normalizeConversationMode = (value: string | undefined): ConversationMode | undefined => {
    if (value === undefined) {
        return undefined;
    }
    const normalized = value.trim().toUpperCase();
    if (isConversationMode(normalized)) {
        return normalized;
    }
    if (normalized in LEGACY_CONVERSATION_MODE_MAP) {
        return LEGACY_CONVERSATION_MODE_MAP[normalized as keyof typeof LEGACY_CONVERSATION_MODE_MAP];
    }
    return undefined;
};
