export type RoadmapGenerationRequestBody = {
    userId: string;
    dreamJob: string;
    stageCount: number;
};

export type GeneratedResource = {
    title: string;
    platform: string;
    url: string;
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
