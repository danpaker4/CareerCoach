import type { ConversationMode } from "./conversation-mode.types";

export const DEFAULT_CONVERSATION_MODE: ConversationMode = "GUIDED";

export const CONVERSATION_MODE_OPTIONS: readonly {
    readonly mode: ConversationMode;
    readonly description: string;
}[] = [
    {
        mode: "GUIDED",
        description: "Default career-coach guidance when the user is still sharing background, skills, preferences, or goals.",
    },
    {
        mode: "FAST_SEARCH",
        description: "Immediate job-search mode when the user asks to find, show, or search jobs now, or gives a concrete role/domain to search.",
    },
    {
        mode: "DEEP_DISCOVERY",
        description: "Discovery mode when the user is unsure, exploring options, or needs help identifying what career direction fits them.",
    },
    {
        mode: "DREAMJOB",
        description: "Long-term aspiration mode when the user describes, changes, or confirms their dream job, dream role, or future career identity.",
    },
] as const;

export const CONVERSATION_MODE_VALUES: readonly ConversationMode[] = CONVERSATION_MODE_OPTIONS.map((option) => option.mode);

export const DREAMJOB_SIGNALS = [
    "dream job",
    "dream role",
    "long term",
    "long-term",
    "in the future",
    "where i want to be",
    "career goal",
    "5 years",
    "10 years",
    "aspiration",
    "someday i want to be",
    "future career",
    "where i see myself",
    "something in the future",
    "looking for something in the future",
    "my own startup",
    "start a startup",
    "i want to be a founder",
] as const;

export const DREAMJOB_CHANGE_SIGNALS = [
    "change my dream job",
    "change my dream role",
    "new dream job",
    "new dream role",
    "update my dream job",
    "different dream job",
] as const;
