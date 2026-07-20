export type PipelineIntent = "PIPELINE_ACCEPT" | "PIPELINE_REJECT";

export type AddJobToPipelineResult =
    | { status: "created" }
    | { status: "already_in_pipeline" }
    | { status: "error"; message: string };
