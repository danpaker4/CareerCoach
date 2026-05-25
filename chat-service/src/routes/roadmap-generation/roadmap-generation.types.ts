export type RoadmapGenerationRequestBody = {
    userId: string;
    dreamJob: string;
    stageCount: number;
};

export type GeneratedStageContent = {
    label: string;
    description: string;
    actions: string[];
    estimatedTimeframe: string;
};

export type RoadmapGenerationResponse = {
    stages: GeneratedStageContent[];
};
