import type { DeterministicStage } from "../builder/deterministic-stage-builder.types";

export type PolishStageWording = {
    readonly stageId: string;
    readonly label: string;
    readonly description: string;
    readonly whyItMatters?: string;
};

export type RoadmapPolishResult = {
    readonly stages: readonly DeterministicStage[];
    readonly polished: boolean;
    readonly reasonCodes: readonly string[];
};
