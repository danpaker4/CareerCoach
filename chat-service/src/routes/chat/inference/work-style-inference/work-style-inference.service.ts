import type { WorkStyleInferenceResult } from "./work-style-inference.types";
import { WORK_STYLE_INFERENCE_RULES } from "./work-style-inference.utils";

export class WorkStyleInferenceService {
    inferFromMessage = (message: string): WorkStyleInferenceResult => {
        const normalized = message.toLowerCase();
        const signals = WORK_STYLE_INFERENCE_RULES.filter((rule) =>
            rule.matches.some((match) => normalized.includes(match))
        ).map((rule) => rule.signal);
        return {
            signals,
            confidence: signals.length === 0 ? 0.35 : Math.min(0.92, 0.55 + (signals.length * 0.1)),
        };
    };
}
