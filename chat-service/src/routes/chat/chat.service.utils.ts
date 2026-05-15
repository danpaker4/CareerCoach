import type { CareerSignal } from "../career-profile/career-profile.types";

export const toSignal = (value: string, confidence: number, evidence: string, source: CareerSignal["source"]): CareerSignal => ({
    value,
    confidence,
    evidence: [evidence],
    source,
    updatedAt: new Date(),
});
