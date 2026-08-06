import type { MarketRequirementsContext } from "./gap-analysis.types";

export type RoadmapEvalFixtureStartingPoint = {
    currentJob: string;
    currentRoleSummary?: string;
    userSkills?: string[];
    demonstratedResponsibilities?: string[];
    roleExperienceYears?: number;
    roleExperienceLevel?: string;
    preferredDomains?: string[];
    longTermGoals?: string[];
    isEntryLevel: boolean;
};

export type RoadmapEvalFixtureRequestBody = {
    caseId?: string;
    dreamJob: string;
    targetYears: number;
    availableHoursPerWeek?: number;
    startingPoint: RoadmapEvalFixtureStartingPoint;
    market?: MarketRequirementsContext | null;
    pathSkills?: string[];
};
