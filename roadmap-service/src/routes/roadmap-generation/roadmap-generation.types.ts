export type RoadmapGenerationRequestBody = {
    userId: string;
    dreamJob: string;
    stageCount: number;
};

export type ResourceType = "course" | "video" | "practice" | "article" | "docs" | "repository" | "certification";

export type GeneratedResource = {
    title: string;
    platform: string;
    url: string;
    type: ResourceType;
};

export type GeneratedStageContent = {
    label: string;
    description: string;
    actions: string[];
    resources: GeneratedResource[];
    estimatedTimeframe: string;
};

export type RoadmapGenerationResponse = {
    stages: GeneratedStageContent[];
};
