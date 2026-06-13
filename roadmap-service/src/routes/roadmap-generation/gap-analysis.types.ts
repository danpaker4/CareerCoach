export type GapAnalysisSnapshot = {
    skillsPresent: string[];
    skillsMissing: string[];
    responsibilitiesMissing: string[];
    leadershipGaps: string[];
    architectureGaps: string[];
    domainGaps: string[];
    experienceGapSummary: string;
};

export type MarketRequirementsContext = {
    roleCategory: string;
    commonSkills: string[];
    responsibilities: string[];
    leadershipSignals: string[];
    architectureSignals: string[];
    seniorityDistribution: Record<string, number>;
};

export type UserCareerContext = {
    currentJob: string;
    currentRoleSummary: string;
    userSkills: string[];
    demonstratedResponsibilities: string[];
    roleExperienceYears: number;
    roleExperienceLevel: string;
    preferredDomains: string[];
    senioritySignal: string | null;
    longTermGoals: string[];
    isEntryLevel?: boolean;
};

export type GapAnalysisInput = {
    user: UserCareerContext;
    market: MarketRequirementsContext | null;
    dreamJob: string;
};
