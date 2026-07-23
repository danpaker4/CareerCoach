import type { PipelineIntent } from "./pipeline.types";

export const PIPELINE_INTENT = {
    ACCEPT: "PIPELINE_ACCEPT",
    REJECT: "PIPELINE_REJECT",
} as const satisfies Record<string, PipelineIntent>;
