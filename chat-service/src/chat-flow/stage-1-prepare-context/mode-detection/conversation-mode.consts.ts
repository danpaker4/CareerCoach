import type { ConversationMode, ConversationModeDetectionResult } from "./conversation-mode.types";

export const CONVERSATION_MODE = {
    DREAMJOB: "DREAMJOB",
    NEAR_TERM: "NEAR_TERM",
    GUIDED: "GUIDED",
} as const satisfies Record<string, ConversationMode>;

export const DEFAULT_CONVERSATION_MODE: ConversationMode = CONVERSATION_MODE.GUIDED;

export const CONVERSATION_MODE_OPTIONS: readonly {
    readonly mode: ConversationMode;
    readonly description: string;
}[] = [
    {
        mode: CONVERSATION_MODE.DREAMJOB,
        description:
            "The user talks about their dreams, work in the future, or long-term goals — not something for the near time.",
    },
    {
        mode: CONVERSATION_MODE.NEAR_TERM,
        description:
            "The user wants a job in the near time: their next job, or a job in the next few months up to a year.",
    },
    {
        mode: CONVERSATION_MODE.GUIDED,
        description:
            "The user has not shown yet whether they want a near-time job or a future dream job. Collect information (skills, current job, goals) to decide between the other two modes.",
    },
] as const;

export const CONVERSATION_MODE_VALUES: readonly ConversationMode[] = CONVERSATION_MODE_OPTIONS.map(
    (option) => option.mode
);

export const DEFAULT_MODE_DETECTION_RESULT: ConversationModeDetectionResult = {
    mode: DEFAULT_CONVERSATION_MODE,
    readinessScore: 0,
    isReady: false,
    missingInformation: [],
    shouldSearchJobs: false,
};
