export type CompletionCriterion = {
    readonly id: string;
    readonly description: string;
    readonly metric: "actions_complete" | "hours_logged" | "artifact_ready" | "self_attest";
    readonly targetValue: number;
};

export type TimelineMeta = {
    readonly effortHours: number;
    readonly hoursPerWeek: number;
    readonly estimatedWeeks: number;
    readonly minMonths: number;
    readonly maxMonths: number;
    readonly assumedAvailability: boolean;
    readonly assumptions: readonly string[];
};

export type StageEvidence = {
    readonly gapIds: readonly string[];
    readonly capabilityIds: readonly string[];
    readonly actionIds: readonly string[];
    readonly resourceIds: readonly string[];
    readonly gapsAddressed: readonly string[];
    readonly transitionReasons: readonly string[];
    readonly marketSignals: readonly string[];
};

export type DeterministicStage = {
    readonly stageId: string;
    readonly templateId: string;
    readonly label: string;
    readonly description: string;
    readonly whyItMatters: string;
    readonly howToGetThere?: string;
    readonly whatYouGain?: string;
    readonly progressionType: "learning" | "experience" | "hybrid";
    readonly actions: readonly string[];
    readonly actionIds: readonly string[];
    readonly resources: readonly {
        readonly title: string;
        readonly platform: string;
        readonly url: string;
        readonly type: "course" | "video" | "practice" | "article" | "docs" | "repository" | "certification";
    }[];
    readonly resourceIds: readonly string[];
    readonly capabilityIds: readonly string[];
    readonly gapIds: readonly string[];
    readonly skillsToBuild: readonly string[];
    readonly responsibilitiesToGain: readonly string[];
    readonly requiredCapabilities: readonly string[];
    readonly roleCategories: readonly string[];
    readonly futureOpportunities: readonly string[];
    readonly experienceAccumulation: string;
    readonly completionCriteria: readonly CompletionCriterion[];
    readonly timelineMeta: TimelineMeta;
    readonly estimatedTimeframe: string;
    readonly evidence: StageEvidence;
    readonly reasonCodes: readonly string[];
};
