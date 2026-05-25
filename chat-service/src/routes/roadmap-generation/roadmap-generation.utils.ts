import type { GeneratedResource, GeneratedStageContent, RoadmapGenerationResponse } from "./roadmap-generation.types";

const PLATFORM_SEARCH_URLS: Record<string, (query: string) => string> = {
    udemy: (q) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(q)}`,
    coursera: (q) => `https://www.coursera.org/search?query=${encodeURIComponent(q)}`,
    youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    pluralsight: (q) => `https://www.pluralsight.com/search?q=${encodeURIComponent(q)}`,
    medium: (q) => `https://medium.com/search?q=${encodeURIComponent(q)}`,
    "dev.to": (q) => `https://dev.to/search?q=${encodeURIComponent(q)}`,
    freecodecamp: (q) => `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(q)}`,
    "official docs": (q) => `https://www.google.com/search?q=${encodeURIComponent(q + " official documentation")}`,
    github: (q) => `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`,
};

const buildResourceUrl = (title: string, platform: string): string => {
    const key = platform.toLowerCase();
    const builder = PLATFORM_SEARCH_URLS[key];
    return builder ? builder(title) : `https://www.google.com/search?q=${encodeURIComponent(title + " " + platform)}`;
};

type RawStage = Record<string, unknown>;

const hasValidCoreFields = (obj: RawStage): boolean =>
    typeof obj.label === "string" &&
    obj.label.trim().length > 0 &&
    typeof obj.description === "string" &&
    Array.isArray(obj.actions) &&
    obj.actions.every((a: unknown) => typeof a === "string");

const extractJsonFromResponse = (raw: string): string => {
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    return codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();
};

const parseResources = (raw: unknown): GeneratedResource[] => {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .filter((r: unknown): r is Record<string, unknown> =>
            typeof r === "object" && r !== null &&
            typeof (r as Record<string, unknown>).title === "string" &&
            typeof (r as Record<string, unknown>).platform === "string"
        )
        .map((r) => {
            const title = (r.title as string).trim();
            const platform = (r.platform as string).trim();
            return {
                title,
                platform,
                url: buildResourceUrl(title, platform),
            };
        })
        .filter((r) => r.title.length > 0);
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

    const validStages = obj.stages.filter(
        (s: unknown): s is RawStage =>
            typeof s === "object" && s !== null && hasValidCoreFields(s as RawStage)
    );
    if (validStages.length === 0) {
        throw new Error("No valid stages in LLM response");
    }

    const stages: GeneratedStageContent[] = validStages
        .slice(0, expectedStageCount)
        .map((stage) => ({
            label: (stage.label as string).trim(),
            description: (stage.description as string).trim(),
            actions: (stage.actions as string[])
                .map((a) => (typeof a === "string" ? a.trim() : String(a)))
                .filter(Boolean),
            resources: parseResources(stage.resources),
            estimatedTimeframe:
                typeof stage.estimatedTimeframe === "string"
                    ? (stage.estimatedTimeframe as string).trim()
                    : "",
        }));

    return { stages };
};
