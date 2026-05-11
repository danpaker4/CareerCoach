export type WorkStyleSignal =
    | "analytical"
    | "creative"
    | "people_oriented"
    | "independent"
    | "leadership_oriented"
    | "hands_on_builder"
    | "research_oriented"
    | "structured_environment"
    | "fast_moving_environment"
    | "prefers_clear_tasks"
    | "enjoys_ambiguity"
    | "low_meetings_preference"
    | "high_ownership_preference";

export type WorkStyleInferenceResult = {
    signals: WorkStyleSignal[];
    confidence: number;
};
