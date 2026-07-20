/** Points added per profile signal item before clamping to 0–100. */
export const SKILLS_CONFIDENCE_POINTS = {
    technologyPerItem: 28,
    strengthPerItem: 14,
} as const;

export const GOALS_CONFIDENCE_POINTS = {
    shortTermGoalPerItem: 28,
    longTermGoalPerItem: 20,
    /** Max points from `(1 - uncertaintyLevel)` when uncertainty is 0–1. */
    clarityFromLowUncertaintyMax: 35,
} as const;

export const PREFERENCES_CONFIDENCE_POINTS = {
    preferredRolePerItem: 30,
    interestPerItem: 16,
    dislikePerItem: 9,
} as const;

export const ROLE_EXPERIENCE_CONFIDENCE_POINTS = {
    roleExperiencePerItem: 35,
} as const;

export const DOMAIN_CONFIDENCE_POINTS = {
    preferredDomainPerItem: 30,
    dislikedDomainPerItem: 10,
} as const;

export const SENIORITY_CONFIDENCE_POINTS = {
    whenKnown: 80,
    whenUnknown: 35,
} as const;

/** Share of each dimension score in search-readiness (must total 100). */
export const SEARCH_READINESS_BLEND_PERCENT = {
    skills: 30,
    goals: 25,
    preferences: 25,
    domain: 20,
} as const;

/** Share of each input in discovery confidence (must total 100). */
export const DISCOVERY_CONFIDENCE_BLEND_PERCENT = {
    preferences: 45,
    roleExperience: 25,
    /** Uses `(100 - goalsConfidence)` as the third input. */
    goalsGap: 30,
} as const;

const assertPercentWeightsSumToHundred = (weights: readonly number[], label: string): void => {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total !== 100) {
        throw new Error(`${label} weights must sum to 100, got ${total}`);
    }
};

assertPercentWeightsSumToHundred(Object.values(SEARCH_READINESS_BLEND_PERCENT), "SEARCH_READINESS_BLEND_PERCENT");
assertPercentWeightsSumToHundred(Object.values(DISCOVERY_CONFIDENCE_BLEND_PERCENT), "DISCOVERY_CONFIDENCE_BLEND_PERCENT");
