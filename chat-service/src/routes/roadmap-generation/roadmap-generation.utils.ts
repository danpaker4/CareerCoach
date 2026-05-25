import type { GeneratedStageContent, RoadmapGenerationResponse } from "./roadmap-generation.types";

const isValidStage = (value: unknown): value is GeneratedStageContent => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.label === "string" &&
        obj.label.trim().length > 0 &&
        typeof obj.description === "string" &&
        Array.isArray(obj.actions) &&
        obj.actions.every((a: unknown) => typeof a === "string")
    );
};

const extractJsonFromResponse = (raw: string): string => {
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    return codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();
};

export const parseRoadmapGenerationResponse = (
    rawText: string,
    expectedStageCount: number
): RoadmapGenerationResponse => {
    const json = extractJsonFromResponse(rawText);
    const parsed: unknown = JSON.parse(json);

    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object roadmap payload");
    }

    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.stages)) {
        throw new Error("LLM response missing 'stages' array");
    }

    const validStages = obj.stages.filter(isValidStage);
    if (validStages.length === 0) {
        throw new Error("No valid stages in LLM response");
    }

    const stages: GeneratedStageContent[] = validStages
        .slice(0, expectedStageCount)
        .map((stage) => ({
            label: stage.label.trim(),
            description: stage.description.trim(),
            actions: stage.actions
                .map((a) => (typeof a === "string" ? a.trim() : String(a)))
                .filter(Boolean),
            estimatedTimeframe:
                typeof (stage as Record<string, unknown>).estimatedTimeframe === "string"
                    ? ((stage as Record<string, unknown>).estimatedTimeframe as string).trim()
                    : "",
        }));

    return { stages };
};
