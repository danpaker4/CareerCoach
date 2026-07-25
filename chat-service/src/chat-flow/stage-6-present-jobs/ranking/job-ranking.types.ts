import type { JobSearchResultItem } from "../../api/shared/chat.types";

export type RankedJobResult = {
    jobId: string;
    finalScore: number;
    scoreBreakdown: {
        skillMatchScore: number;
        semanticSimilarityScore: number;
        preferenceFitScore: number;
        growthPotentialScore: number;
        locationOrConstraintFitScore: number;
    };
    reasons: string[];
    concerns: string[];
    missingSkills: string[];
    job: JobSearchResultItem;
};
