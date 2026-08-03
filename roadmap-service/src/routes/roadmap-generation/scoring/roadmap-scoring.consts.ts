export const MARKET_IMPORTANCE_WEIGHTS = {
    frequency: 1,
    requirementStrength: 1,
    recency: 1,
    sourceConfidence: 1,
} as const;

export const REQUIREMENT_STRENGTH = {
    mustHave: 1,
    shouldHave: 0.7,
    niceToHave: 0.4,
} as const;

export const SOURCE_CONFIDENCE = {
    marketJobs: 1,
    roleKnowledge: 0.75,
    directionHint: 0.5,
    inferred: 0.35,
} as const;

export const RECENCY_DEFAULT = 1;

export const LEVEL = {
    none: 0,
    awareness: 1,
    working: 2,
    proficient: 3,
    expert: 4,
} as const;

export const DEFAULT_CURRENT_LEVEL = LEVEL.none;

export const TIMELINE_MULTIPLIERS = {
    dependencyOverhead: 1.1,
    parallelizationDiscount: 0.9,
    buffer: 1.15,
} as const;

export const PRIORITY_WEIGHTS = {
    gapScore: 1,
    marketImportance: 1,
    transitionRelevance: 1,
    dependencyWeight: 1,
    confidence: 1,
} as const;
