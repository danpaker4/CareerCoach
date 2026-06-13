import type {
    DreamJobRoadmapGenerator,
    GeneratedResource,
    GeneratedStageContent,
    RoadmapGenerationResponse,
} from "./chat.dream-job-roadmap.types";

const RESOURCE_TYPES = new Set<string>([
    "course",
    "video",
    "practice",
    "article",
    "docs",
    "repository",
    "certification",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === "string");

const isGeneratedResource = (value: unknown): value is GeneratedResource => {
    if (!isRecord(value)) {
        return false;
    }

    const type = value.type;
    return (
        typeof value.title === "string" &&
        typeof value.platform === "string" &&
        typeof value.url === "string" &&
        (type === undefined || (typeof type === "string" && RESOURCE_TYPES.has(type)))
    );
};

const isGeneratedStageContent = (value: unknown): value is GeneratedStageContent => {
    if (!isRecord(value)) {
        return false;
    }

    const resources = value.resources;
    const estimatedTimeframe = value.estimatedTimeframe;
    return (
        typeof value.label === "string" &&
        typeof value.description === "string" &&
        isStringArray(value.actions) &&
        (resources === undefined || (Array.isArray(resources) && resources.every(isGeneratedResource))) &&
        (estimatedTimeframe === undefined || typeof estimatedTimeframe === "string")
    );
};

const isRoadmapGenerationResponse = (value: unknown): value is RoadmapGenerationResponse =>
    isRecord(value) && Array.isArray(value.stages) && value.stages.every(isGeneratedStageContent);

export class DreamJobRoadmapHttpGenerator implements DreamJobRoadmapGenerator {
    constructor(private readonly roadmapServiceBaseUrl: string) {}

    generate = async (userId: string, dreamJob: string, stageCount: number): Promise<RoadmapGenerationResponse> => {
        const baseUrl = this.roadmapServiceBaseUrl.replace(/\/$/, "");
        const response = await fetch(`${baseUrl}/roadmap/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, dreamJob, stageCount }),
        });

        if (!response.ok) {
            throw new Error("Roadmap generation failed");
        }

        const payload: unknown = await response.json().catch(() => null);
        if (!isRoadmapGenerationResponse(payload)) {
            throw new Error("Roadmap generation response was invalid");
        }

        return payload;
    };
}
