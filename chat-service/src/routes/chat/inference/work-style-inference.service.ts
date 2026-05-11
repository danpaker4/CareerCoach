import type { WorkStyleInferenceResult, WorkStyleSignal } from "./work-style-inference.types";

const RULES: Array<{ signal: WorkStyleSignal; matches: readonly string[] }> = [
    { signal: "independent", matches: ["alone", "independent", "myself"] },
    { signal: "low_meetings_preference", matches: ["hate meetings", "few meetings", "less meetings"] },
    { signal: "hands_on_builder", matches: ["build", "coding", "implement"] },
    { signal: "analytical", matches: ["analyze", "debug", "investigate"] },
    { signal: "people_oriented", matches: ["help people", "customers", "teamwork"] },
    { signal: "creative", matches: ["design", "creative", "ideas"] },
    { signal: "high_ownership_preference", matches: ["ownership", "end to end"] },
];

export class WorkStyleInferenceService {
    inferFromMessage = (message: string): WorkStyleInferenceResult => {
        const normalized = message.toLowerCase();
        const signals = RULES.filter((rule) => rule.matches.some((match) => normalized.includes(match))).map((rule) => rule.signal);
        return {
            signals,
            confidence: signals.length === 0 ? 0.35 : Math.min(0.92, 0.55 + (signals.length * 0.1)),
        };
    };
}
