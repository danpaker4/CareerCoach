export type RoadmapGenerationRequestBody = {
    userId: string;
    dreamJob: string;
    targetYears: number;
    availableHoursPerWeek?: number;
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

export type CompletionCriterion = {
    id: string;
    description: string;
    metric: "actions_complete" | "hours_logged" | "artifact_ready" | "self_attest";
    targetValue: number;
};

export type TimelineMeta = {
    effortHours: number;
    hoursPerWeek: number;
    estimatedWeeks: number;
    minMonths?: number;
    maxMonths?: number;
    assumedAvailability: boolean;
    assumptions?: string[];
};

export type StageEvidence = {
    gapIds: string[];
    capabilityIds: string[];
    actionIds: string[];
    resourceIds: string[];
    gapsAddressed?: string[];
    transitionReasons?: string[];
    marketSignals?: string[];
};

export type SelectedPathMeta = {
    fromRole: string;
    toRole: string;
    requiredSkills: string[];
    overlapScore: number;
    source: string;
    rankScore: number;
    reasonCodes: string[];
    selectedCareerPath?: string[];
};

export type StructuredCapabilityGap = {
    gapId: string;
    capabilityId: string;
    label: string;
    category: string;
    requiredLevel: number;
    currentLevel: number;
    gapScore: number;
    marketImportance: number;
    priorityScore: number;
    reasonCodes: string[];
};

export type RemovedInputExample = {
    input: string;
    reason:
        | "duplicate"
        | "job-ad-text"
        | "company-name"
        | "irrelevant"
        | "low-confidence"
        | "wrong-category"
        | "too-specific"
        | "personal-trait"
        | "years-as-skill";
};

export type CareerProgressionMeta = {
    currentRoleSummary?: string;
    dreamRoleCategory: string;
    estimatedYearsToGoal?: string;
    progressionReasoning?: string;
    gapAnalysis?: GapAnalysisSnapshot;
    generationVersion?: string;
    generationMode?: string;
    selectedPath?: SelectedPathMeta;
    selectedCareerPath?: string[];
    structuredGapAnalysis?: {
        gaps: StructuredCapabilityGap[];
    };
    removedInputExamples?: RemovedInputExample[];
    totalTimeline?: {
        minYears: number;
        maxYears: number;
        overlappingStages: boolean;
        assumptions: string[];
    };
};

export type GeneratedStageContent = {
    label: string;
    description: string;
    actions: string[];
    resources: GeneratedResource[];
    estimatedTimeframe: string;
    whyItMatters: string;
    howToGetThere?: string;
    whatYouGain?: string;
    progressionType: ProgressionType;
    requiredCapabilities: string[];
    skillsToBuild: string[];
    responsibilitiesToGain: string[];
    experienceAccumulation: string;
    roleCategories: string[];
    futureOpportunities: string[];
    templateId?: string;
    capabilityIds?: string[];
    gapIds?: string[];
    completionCriteria?: CompletionCriterion[];
    timelineMeta?: TimelineMeta;
    evidence?: StageEvidence;
    reasonCodes?: string[];
    actionIds?: string[];
    resourceIds?: string[];
};

export type RoadmapGenerationResponse = {
    stages: GeneratedStageContent[];
    progressionMeta: CareerProgressionMeta;
    gapAnalysis: GapAnalysisSnapshot;
    generationVersion?: string;
    generationMode?: string;
    selectedPath?: SelectedPathMeta;
    structuredGapAnalysis?: CareerProgressionMeta["structuredGapAnalysis"];
    selectedCareerPath?: string[];
    removedInputExamples?: RemovedInputExample[];
};
