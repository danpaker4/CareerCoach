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
    whyItMatters?: string;
    progressionType?: "learning" | "experience" | "hybrid";
    requiredCapabilities?: string[];
    skillsToBuild?: string[];
    responsibilitiesToGain?: string[];
    experienceAccumulation?: string;
    roleCategories?: string[];
    futureOpportunities?: string[];
    templateId?: string;
    capabilityIds?: string[];
    gapIds?: string[];
    reasonCodes?: string[];
};

export type CareerProgressionMeta = {
    currentRoleSummary?: string;
    dreamRoleCategory: string;
    estimatedYearsToGoal?: string;
    progressionReasoning?: string;
    gapAnalysis?: {
        skillsPresent: string[];
        skillsMissing: string[];
        responsibilitiesMissing: string[];
        leadershipGaps: string[];
        architectureGaps: string[];
        domainGaps: string[];
        experienceGapSummary: string;
    };
    generationVersion?: string;
    generationMode?: string;
};

export type RoadmapGenerationResponse = {
    stages: GeneratedStageContent[];
    progressionMeta?: CareerProgressionMeta;
    gapAnalysis?: CareerProgressionMeta["gapAnalysis"];
    generationVersion?: string;
    generationMode?: string;
};

export type DreamJobRoadmapFailureReason = "generation_failed" | "invalid_stage_count" | "persistence_failed";

export type DreamJobRoadmapCreationResult =
    | { created: true }
    | { created: false; reason: DreamJobRoadmapFailureReason };

export type DreamJobRoadmapGenerator = {
    generate: (userId: string, dreamJob: string, targetYears: number) => Promise<RoadmapGenerationResponse>;
};

export type DreamJobRoadmapPersistence = {
    createCareerRoadmap: (params: CreateCareerRoadmapParams) => Promise<boolean>;
};

export type DreamJobRoadmapCreator = {
    create: (userId: string, dreamJob: string) => Promise<DreamJobRoadmapCreationResult>;
};
