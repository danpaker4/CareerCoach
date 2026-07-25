import type { ConversationMode, ConversationModeDetectionResult } from "./conversation-mode.types";

export const CONVERSATION_MODE = {
    DREAMJOB: "DREAMJOB",
    NEAR_TERM: "NEAR_TERM",
    GUIDED: "GUIDED",
    SKILLS_GAP: "SKILLS_GAP",
    CV_IMPROVE: "CV_IMPROVE",
    INTERVIEW_PREP: "INTERVIEW_PREP",
} as const satisfies Record<string, ConversationMode>;

export const DEFAULT_CONVERSATION_MODE: ConversationMode = CONVERSATION_MODE.GUIDED;

/** Modes that LLM mode-detection may choose (sticky quick-help modes are set by shortcuts only). */
export const DETECTABLE_CONVERSATION_MODE_OPTIONS: readonly {
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

/** @deprecated Prefer DETECTABLE_CONVERSATION_MODE_OPTIONS for LLM prompts; kept for callers expecting all modes. */
export const CONVERSATION_MODE_OPTIONS = DETECTABLE_CONVERSATION_MODE_OPTIONS;

export const CONVERSATION_MODE_VALUES: readonly ConversationMode[] = [
    CONVERSATION_MODE.DREAMJOB,
    CONVERSATION_MODE.NEAR_TERM,
    CONVERSATION_MODE.GUIDED,
    CONVERSATION_MODE.SKILLS_GAP,
    CONVERSATION_MODE.CV_IMPROVE,
    CONVERSATION_MODE.INTERVIEW_PREP,
] as const;

export const STICKY_QUICK_HELP_MODES: readonly ConversationMode[] = [
    CONVERSATION_MODE.SKILLS_GAP,
    CONVERSATION_MODE.CV_IMPROVE,
    CONVERSATION_MODE.INTERVIEW_PREP,
] as const;

export const DEFAULT_MODE_DETECTION_RESULT: ConversationModeDetectionResult = {
    mode: DEFAULT_CONVERSATION_MODE,
    readinessScore: 0,
    isReady: false,
    missingInformation: [],
    shouldSearchJobs: false,
};
