import type { TextCompletionPort } from "../../../ai/ports/text-completion.types";
import type { DeterministicStage } from "../builder/deterministic-stage-builder.types";
import { buildRoadmapPolishPrompt } from "./roadmap-polish.prompt.utils";
import type { PolishStageWording, RoadmapPolishResult } from "./roadmap-polish.types";

const extractJsonObject = (rawText: string): unknown => {
    const trimmed = rawText.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() ?? trimmed;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    } catch {
        return null;
    }
};

const parsePolishStages = (value: unknown, expectedIds: readonly string[]): PolishStageWording[] | null => {
    if (typeof value !== "object" || value === null || !("stages" in value)) return null;
    const stages = (value as { stages: unknown }).stages;
    if (!Array.isArray(stages) || stages.length !== expectedIds.length) return null;

    const parsed: PolishStageWording[] = [];
    const seen = new Set<string>();
    for (const item of stages) {
        if (typeof item !== "object" || item === null) return null;
        const record = item as Record<string, unknown>;
        const stageId = record.stageId;
        const label = record.label;
        const description = record.description;
        const whyItMatters = record.whyItMatters;
        if (typeof stageId !== "string" || typeof label !== "string" || typeof description !== "string") {
            return null;
        }
        if (!expectedIds.includes(stageId) || seen.has(stageId)) return null;
        if (label.trim().length === 0 || description.trim().length === 0) return null;
        seen.add(stageId);
        parsed.push({
            stageId,
            label: label.trim(),
            description: description.trim(),
            whyItMatters: typeof whyItMatters === "string" ? whyItMatters.trim() : undefined,
        });
    }

    if (seen.size !== expectedIds.length) return null;
    return parsed;
};

export const applyRoadmapPolish = async (params: {
    readonly textCompletion: TextCompletionPort;
    readonly userId: string;
    readonly dreamJob: string;
    readonly stages: readonly DeterministicStage[];
}): Promise<RoadmapPolishResult> => {
    const expectedIds = params.stages.map((stage) => stage.stageId);
    try {
        const rawText = await params.textCompletion.complete(
            buildRoadmapPolishPrompt({ dreamJob: params.dreamJob, stages: params.stages }),
            { operation: "roadmap.polish", userId: params.userId }
        );
        const parsed = parsePolishStages(extractJsonObject(rawText), expectedIds);
        if (!parsed) {
            return {
                stages: params.stages,
                polished: false,
                reasonCodes: ["polish_rejected_structural_drift"],
            };
        }

        const byId = new Map(parsed.map((stage) => [stage.stageId, stage]));
        const merged = params.stages.map((stage) => {
            const wording = byId.get(stage.stageId);
            if (!wording) return stage;
            return {
                ...stage,
                label: wording.label,
                description: wording.description,
                whyItMatters: wording.whyItMatters ?? stage.whyItMatters,
                reasonCodes: [...stage.reasonCodes, "ai_polish_applied"],
            };
        });

        return { stages: merged, polished: true, reasonCodes: ["ai_polish_applied"] };
    } catch {
        return {
            stages: params.stages,
            polished: false,
            reasonCodes: ["polish_llm_unavailable"],
        };
    }
};
