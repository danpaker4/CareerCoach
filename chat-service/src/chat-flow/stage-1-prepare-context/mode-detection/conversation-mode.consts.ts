import type { ConversationMode } from "./conversation-mode.types";

export const DEFAULT_CONVERSATION_MODE: ConversationMode = "GUIDED";

export const CONVERSATION_MODE_OPTIONS: readonly {
    readonly mode: ConversationMode;
    readonly description: string;
}[] = [
    {
        mode: "GUIDED",
        description:
            "Default coaching mode for background, skills, preferences, and timeline. Use when the user has not decided short-term vs long-term yet, or needs clarifying questions before searching or setting a dream role.",
    },
    {
        mode: "FAST_SEARCH",
        description:
            "Immediate job-search mode only when the user explicitly asks to find, show, or search jobs right now.",
    },
    {
        mode: "DEEP_DISCOVERY",
        description: "Discovery mode when the user is unsure, exploring options, or needs help identifying what career direction fits them.",
    },
    {
        mode: "DREAMJOB",
        description:
            "Long-term aspiration mode only when the user clearly wants a future dream job / dream role, not when timeline is still unclear.",
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

/** Explicit search commands that should enter FAST_SEARCH. */
export const EXPLICIT_FAST_SEARCH_SIGNALS = [
    "find me a job",
    "find a job now",
    "find a job asap",
    "looking for a job now",
    "need a job now",
    "need a job asap",
    "want a job now",
    "job right now",
    "search for jobs",
    "search jobs",
    "show me jobs",
    "show me roles",
] as const;

/** Phrases that mean the user has not decided short-term vs long-term yet. */
export const TIMELINE_UNCERTAINTY_SIGNALS = [
    "not sure",
    "not sure if",
    "dont know if",
    "don't know if",
    "do not know if",
    "unsure",
    "haven't decided",
    "have not decided",
    "still deciding",
    "figuring out",
    "either short or long",
    "short or long term",
    "short-term or long-term",
] as const;
