export type MarketImportanceInput = {
    readonly frequency: number;
    readonly requirementStrength: number;
    readonly recency: number;
    readonly sourceConfidence: number;
};

export type GapScoreInput = {
    readonly requiredLevel: number;
    readonly currentLevel: number;
};

export type PriorityScoreInput = {
    readonly gapScore: number;
    readonly marketImportance: number;
    readonly transitionRelevance: number;
    readonly dependencyWeight: number;
    readonly confidence: number;
};

export type TimelineWeeksInput = {
    readonly effortHours: number;
    readonly hoursPerWeek: number;
    readonly dependencyOverhead?: number;
    readonly parallelizationDiscount?: number;
    readonly buffer?: number;
};
