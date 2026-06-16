export type RoadmapGenerationRequestBody = {
    userId: string;
    dreamJob: string;
    targetYears: number;
};

export type ResourceType = "course" | "video" | "practice" | "article" | "docs" | "repository" | "certification";

export type ProgressionType = "learning" | "experience" | "hybrid";

export type GeneratedResource = {
    title: string;
    platform: string;
    url: string;
    type: ResourceType;
};

export type GapAnalysisSnapshot = {
    skillsPresent: string[];
    skillsMissing: string[];
    responsibilitiesMissing: string[];
    leadershipGaps: string[];
    architectureGaps: string[];
    domainGaps: string[];
    experienceGapSummary: string;
};

export type CareerProgressionMeta = {
    currentRoleSummary?: string;
    dreamRoleCategory: string;
    estimatedYearsToGoal?: string;
    progressionReasoning?: string;
};

export type GeneratedStageContent = {
    label: string;
    description: string;
    actions: string[];
    resources: GeneratedResource[];
    estimatedTimeframe: string;
    whyItMatters: string;
    progressionType: ProgressionType;
    requiredCapabilities: string[];
    skillsToBuild: string[];
    responsibilitiesToGain: string[];
    experienceAccumulation: string;
    roleCategories: string[];
    futureOpportunities: string[];
};

export type RoadmapGenerationResponse = {
    stages: GeneratedStageContent[];
    progressionMeta: CareerProgressionMeta;
    gapAnalysis: GapAnalysisSnapshot;
};
