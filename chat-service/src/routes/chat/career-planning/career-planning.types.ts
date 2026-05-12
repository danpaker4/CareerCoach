export type CareerPlanningMode = "UNKNOWN" | "IMMEDIATE" | "FUTURE_PLANNING";

export type CareerPlanningModeResolution = {
    /** Mode used for gating this turn (`undefined` in DB is treated as UNKNOWN). */
    readonly effectiveMode: CareerPlanningMode;
    /** Persist when non-null. */
    readonly nextStoredMode: CareerPlanningMode | null;
    readonly shouldAskDistinctionQuestion: boolean;
    /** When true with distinction question, use richer intro for background-only first messages. */
    readonly useBackgroundAckDistinction: boolean;
    readonly shouldSetDistinctionAskedAt: boolean;
    /** When true, persist `careerPlanningMode: "IMMEDIATE"` for ambiguous post-prompt users. */
    readonly forceImmediateAfterAmbiguousPrompt: boolean;
};

export type DreamJobLlmPayload = {
    readonly dreamJob: string;
    readonly confidence: number;
    readonly reasoning: readonly string[];
};
