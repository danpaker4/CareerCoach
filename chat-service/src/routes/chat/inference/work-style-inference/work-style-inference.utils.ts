import type { WorkStyleSignal } from "./work-style-inference.types";

export type WorkStyleInferenceRule = {
    signal: WorkStyleSignal;
    matches: readonly string[];
};

export const WORK_STYLE_INFERENCE_RULES: readonly WorkStyleInferenceRule[] = [
    { signal: "independent", matches: ["alone", "independent", "myself"] },
    { signal: "low_meetings_preference", matches: ["hate meetings", "few meetings", "less meetings"] },
    { signal: "hands_on_builder", matches: ["build", "coding", "implement"] },
    { signal: "analytical", matches: ["analyze", "debug", "investigate"] },
    { signal: "people_oriented", matches: ["help people", "customers", "teamwork"] },
    { signal: "creative", matches: ["design", "creative", "ideas"] },
    { signal: "high_ownership_preference", matches: ["ownership", "end to end"] },
];
