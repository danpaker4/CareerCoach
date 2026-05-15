import type { UserCareerProfile } from "../../career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../external-chat/role-experience.types";
import { isJobSeniorityCompatibleWithRoleExperience } from "../inference/seniority-inference/seniority-inference.utils";
import type { JobSearchResultItem } from "../chat.types";
import type { RankedJobResult } from "./job-ranking.types";

const toLowerSet = (items: readonly string[]): Set<string> => new Set(items.map((item) => item.toLowerCase()));
const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export class JobRankingService {
    rankJobs = (
        profile: UserCareerProfile,
        jobs: readonly JobSearchResultItem[],
        roleExperience: readonly RoleExperienceEntry[] = []
    ): RankedJobResult[] => {
        const skills = toLowerSet(profile.technologies.map((item) => item.value));
        const preferences = toLowerSet(profile.interests.map((item) => item.value));
        const seniorityEligibleJobs = jobs.filter((job) =>
            isJobSeniorityCompatibleWithRoleExperience(roleExperience, job)
        );

        const scored = seniorityEligibleJobs.map((job) => {
            const corpus = `${job.title} ${job.description}`.toLowerCase();
            const skillHits = [...skills].filter((skill) => corpus.includes(skill)).length;
            const prefHits = [...preferences].filter((pref) => corpus.includes(pref)).length;
            const skillMatchScore = clamp(skillHits * 20);
            const semanticSimilarityScore = clamp((prefHits * 18) + (skillHits * 8));
            const preferenceFitScore = clamp(prefHits * 22);
            const growthPotentialScore = clamp(job.seniority.toLowerCase().includes("junior") ? 65 : 55);
            const seniorityFitScore = clamp(
                isJobSeniorityCompatibleWithRoleExperience(roleExperience, job) ? 80 : 40
            );
            const locationOrConstraintFitScore = 50;
            const finalScore = clamp(
                (skillMatchScore * 0.30)
                + (semanticSimilarityScore * 0.25)
                + (preferenceFitScore * 0.15)
                + (growthPotentialScore * 0.15)
                + (seniorityFitScore * 0.10)
                + (locationOrConstraintFitScore * 0.05)
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
                    seniorityFitScore,
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
