import type { JobSearchResultItem } from "../chat.types";

export type RankedJobResult = {
    jobId: string;
    finalScore: number;
    scoreBreakdown: {
        skillMatchScore: number;
        semanticSimilarityScore: number;
        preferenceFitScore: number;
        growthPotentialScore: number;
        workStyleFitScore: number;
        locationOrConstraintFitScore: number;
    };
    reasons: string[];
    concerns: string[];
    missingSkills: string[];
    job: JobSearchResultItem;
};
