import type { DeterministicStage } from "../builder/deterministic-stage-builder.types";

export const buildRoadmapPolishPrompt = (params: {
    readonly dreamJob: string;
    readonly stages: readonly DeterministicStage[];
}): string => {
    const stagePayload = params.stages.map((stage) => ({
        stageId: stage.stageId,
        label: stage.label,
        description: stage.description,
        whyItMatters: stage.whyItMatters,
        capabilityIds: stage.capabilityIds,
        actionTitles: stage.actions,
    }));

    return [
        "You polish career roadmap stage wording only.",
        "Do not add/remove stages, actions, resources, IDs, or timelines.",
        "Return JSON only: {\"stages\":[{\"stageId\":\"...\",\"label\":\"...\",\"description\":\"...\",\"whyItMatters\":\"...\"}]}",
        `Dream job: ${params.dreamJob}`,
        "Stages:",
        JSON.stringify(stagePayload),
    ].join("\n");
};
