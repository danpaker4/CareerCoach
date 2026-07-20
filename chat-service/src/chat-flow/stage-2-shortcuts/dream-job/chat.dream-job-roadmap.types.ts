import type { CreateCareerRoadmapParams } from "../../../routes/external-chat-tools/chat.external.types";

export type ResourceType = "course" | "video" | "practice" | "article" | "docs" | "repository" | "certification";

export type GeneratedResource = {
    title: string;
    platform: string;
    url: string;
    type?: ResourceType;
};

export type GeneratedStageContent = {
    label: string;
    description: string;
    actions: string[];
    resources?: GeneratedResource[];
    estimatedTimeframe?: string;
};

export type RoadmapGenerationResponse = {
    stages: GeneratedStageContent[];
};

export type DreamJobRoadmapFailureReason = "generation_failed" | "invalid_stage_count" | "persistence_failed";

export type DreamJobRoadmapCreationResult =
    | { created: true }
    | { created: false; reason: DreamJobRoadmapFailureReason };

export type DreamJobRoadmapGenerator = {
    generate: (userId: string, dreamJob: string, stageCount: number) => Promise<RoadmapGenerationResponse>;
};

export type DreamJobRoadmapPersistence = {
    createCareerRoadmap: (params: CreateCareerRoadmapParams) => Promise<boolean>;
};

export type DreamJobRoadmapCreator = {
    create: (userId: string, dreamJob: string) => Promise<DreamJobRoadmapCreationResult>;
};
