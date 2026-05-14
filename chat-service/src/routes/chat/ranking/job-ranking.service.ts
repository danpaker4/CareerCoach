import type { UserCareerProfile } from "../../career-profile/career-profile.types";
import type { JobSearchResultItem } from "../chat.types";
import type { RankedJobResult } from "./job-ranking.types";

const toLowerSet = (items: readonly string[]): Set<string> => new Set(items.map((item) => item.toLowerCase()));
const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export class JobRankingService {
    rankJobs = (profile: UserCareerProfile, jobs: readonly JobSearchResultItem[]): RankedJobResult[] => {
        const skills = toLowerSet(profile.technologies.map((item) => item.value));
        const preferences = toLowerSet(profile.interests.map((item) => item.value));
        const workStyle = toLowerSet(profile.workStyle.map((item) => item.value));

        const scored = jobs.map((job) => {
            const corpus = `${job.jobTitle} ${job.description}`.toLowerCase();
            const skillHits = [...skills].filter((skill) => corpus.includes(skill)).length;
            const prefHits = [...preferences].filter((pref) => corpus.includes(pref)).length;
            const styleHits = [...workStyle].filter((style) => corpus.includes(style)).length;
            const skillMatchScore = clamp(skillHits * 20);
            const semanticSimilarityScore = clamp((prefHits * 18) + (skillHits * 8));
            const preferenceFitScore = clamp(prefHits * 22);
            const growthPotentialScore = clamp(job.seniority.toLowerCase().includes("junior") ? 65 : 55);
            const workStyleFitScore = clamp(styleHits * 25);
            const locationOrConstraintFitScore = 50;
            const finalScore = clamp(
                (skillMatchScore * 0.30)
                + (semanticSimilarityScore * 0.25)
                + (preferenceFitScore * 0.15)
                + (growthPotentialScore * 0.15)
                + (workStyleFitScore * 0.10)
                + (locationOrConstraintFitScore * 0.05)
            );
            const missingSkills = [...skills].filter((skill) => !corpus.includes(skill)).slice(0, 4);
            const reasons = [
                skillHits > 0 ? "Matches your known technologies." : "Aligned with your general profile.",
                prefHits > 0 ? "Reflects your stated interests." : "Could broaden your direction options.",
            ];
            const concerns = missingSkills.length > 0 ? ["Some core skills are not explicit in this role description."] : [];

            return {
                jobId: job.jobId,
                finalScore,
                scoreBreakdown: {
                    skillMatchScore,
                    semanticSimilarityScore,
                    preferenceFitScore,
                    growthPotentialScore,
                    workStyleFitScore,
                    locationOrConstraintFitScore,
                },
                reasons,
                concerns,
                missingSkills,
                job,
            } satisfies RankedJobResult;
        });

        return scored.sort((a, b) => b.finalScore - a.finalScore);
    };
}
