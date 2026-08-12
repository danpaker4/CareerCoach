export type RecommendationSource = "profile-match" | "job-market" | "employer-signal" | "reviewed-template" | "ai-personalized";

export type RecommendedRole = {
    readonly id: string;
    readonly title: string;
    readonly fit: "pursue-now" | "prepare-first";
    readonly whyItFits: string;
    readonly experienceGained: string;
    readonly missingRequirements: readonly string[];
    readonly internalMoveSuitable: boolean;
    readonly source: RecommendationSource;
};

export type RecommendedMission = {
    readonly id: string;
    readonly title: string;
    readonly requestToManager: string;
    readonly responsibilities: readonly string[];
    readonly outcomes: readonly string[];
    readonly fallback: string;
    readonly source: RecommendationSource;
};

export type RecommendedProject = {
    readonly id: string;
    readonly title: string;
    readonly objective: string;
    readonly tasks: readonly string[];
    readonly deliverables: readonly string[];
    readonly estimatedHours: number;
    readonly completionChecklist: readonly string[];
    readonly toolsAndSkills: readonly string[];
    readonly roleRelevance: string;
    readonly optionalGuidance: readonly string[];
    readonly level: "beginner" | "intermediate" | "advanced";
    readonly source: RecommendationSource;
};

export type ActionableRoute = {
    readonly id: string;
    readonly type: "job" | "internal" | "project" | "combined";
    readonly title: string;
    readonly summary: string;
    readonly whyRecommended: string;
    readonly completionRule: string;
    readonly isRecommended: boolean;
    readonly source: RecommendationSource;
    readonly confidence: "high" | "medium" | "low";
    readonly roleOptions: readonly RecommendedRole[];
    readonly missionOptions: readonly RecommendedMission[];
    readonly projectOptions: readonly RecommendedProject[];
    readonly supportingResourceUrls: readonly string[];
};

export type StageActionPlan = {
    readonly outcome: string;
    readonly recommendedRouteId: string;
    readonly routes: readonly ActionableRoute[];
};
