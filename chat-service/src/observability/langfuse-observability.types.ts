import type { SpanAttributes } from "@opentelemetry/api";

export type LangfuseObservationType = "span" | "chain" | "generation" | "embedding";

export type LangfuseObservationInput = {
    readonly operation: string;
    readonly type: LangfuseObservationType;
    readonly feature: string;
    readonly provider?: string;
    readonly model?: string;
    readonly userId?: string;
    readonly sessionId?: string;
};

export type LangfuseContentAttributes = SpanAttributes;
