import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { JobSearchResultItem } from "../../api/shared/chat.types";
import type { RankedJobResult } from "./job-ranking.types";
import { buildRankingCorpus, extractRoleTerms, scoreRoleRelevance } from "./job-ranking.utils";

const toLowerSet = (items: readonly string[]): Set<string> => new Set(items.map((item) => item.toLowerCase()));
const clamp = (value: number): number => Math.max(0, Math.min(100, value));

/**
 * `targetRole` is the role the search was for. Without it, a user with no profile yet scores every
 * posting identically and the list ends up ordered by the growth bonus alone — so a search for one
 * role can open with a posting for another.
 */
export const rankJobs = (
    profile: UserCareerProfile,
    jobs: readonly JobSearchResultItem[],
    targetRole?: string
): RankedJobResult[] => {
    const skills = toLowerSet(profile.technologies.map((item) => item.value));
    const preferences = toLowerSet(profile.interests.map((item) => item.value));
    const roleTerms = extractRoleTerms(targetRole);

    const scored = jobs.map((job) => {
        const corpus = buildRankingCorpus(job);
        const skillHits = [...skills].filter((skill) => corpus.includes(skill)).length;
        const prefHits = [...preferences].filter((pref) => corpus.includes(pref)).length;
        const roleRelevance = scoreRoleRelevance(roleTerms, job);
        const skillMatchScore = clamp(skillHits * 20);
        const semanticSimilarityScore = clamp(Math.max(roleRelevance, (prefHits * 18) + (skillHits * 8)));
        const preferenceFitScore = clamp(prefHits * 22);
        const growthPotentialScore = clamp(job.seniority.toLowerCase().includes("junior") ? 65 : 55);
        const locationOrConstraintFitScore = 50;
        const finalScore = clamp(
            (skillMatchScore * 0.35)
            + (semanticSimilarityScore * 0.25)
            + (preferenceFitScore * 0.15)
            + (growthPotentialScore * 0.15)
            + (locationOrConstraintFitScore * 0.10)
        );
        const missingSkills = [...skills].filter((skill) => !corpus.includes(skill)).slice(0, 4);
        const reasons = [
            skillHits > 0 ? "Matches your known technologies." : "Aligned with your general profile.",
            prefHits > 0 ? "Reflects your stated interests." : "Could broaden your direction options.",
        ];
        const concerns = missingSkills.length > 0 ? ["Some core skills are not explicit in this role description."] : [];

        return {
            jobId: job.id,
            finalScore,
            scoreBreakdown: {
                skillMatchScore,
                semanticSimilarityScore,
                preferenceFitScore,
                growthPotentialScore,
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
