import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { JobSearchResultItem } from "../../api/shared/chat.types";
import type { RankedJobResult } from "./job-ranking.types";

const toLowerSet = (items: readonly string[]): Set<string> => new Set(items.map((item) => item.toLowerCase()));
const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export const rankJobs = (profile: UserCareerProfile, jobs: readonly JobSearchResultItem[]): RankedJobResult[] => {
    const skills = toLowerSet(profile.technologies.map((item) => item.value));
    const preferences = toLowerSet(profile.interests.map((item) => item.value));

    const scored = jobs.map((job) => {
        const corpus = `${job.title} ${job.description}`.toLowerCase();
        const skillHits = [...skills].filter((skill) => corpus.includes(skill)).length;
        const prefHits = [...preferences].filter((pref) => corpus.includes(pref)).length;
        const skillMatchScore = clamp(skillHits * 20);
        const semanticSimilarityScore = clamp((prefHits * 18) + (skillHits * 8));
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

/** Rank by how well the job matches the user's requested search query (title-weighted). */
export const rankJobsBySearchQuery = (
    searchQuery: string,
    jobs: readonly JobSearchResultItem[],
): RankedJobResult[] => {
    const tokens = searchQuery
        .toLowerCase()
        .split(/[^a-z0-9+#.]/i)
        .map((token) => token.trim())
        .filter((token) => token.length > 1);

    const scored = jobs.map((job) => {
        const title = job.title.toLowerCase();
        const corpus = `${job.title} ${job.description}`.toLowerCase();
        const titleHits = tokens.filter((token) => title.includes(token)).length;
        const corpusHits = tokens.filter((token) => corpus.includes(token)).length;
        const finalScore = clamp((titleHits * 40) + (corpusHits * 12));
        return {
            jobId: job.id,
            finalScore,
            scoreBreakdown: {
                skillMatchScore: clamp(titleHits * 30),
                semanticSimilarityScore: clamp(corpusHits * 15),
                preferenceFitScore: clamp(titleHits * 25),
                growthPotentialScore: 50,
                locationOrConstraintFitScore: 50,
            },
            reasons: [
                titleHits > 0 ? "Title matches your search." : "Related to your search terms.",
            ],
            concerns: [],
            missingSkills: [],
            job,
        } satisfies RankedJobResult;
    });

    return scored.sort((a, b) => b.finalScore - a.finalScore);
};

const WEAK_DIRECTION_TOKENS = new Set([
    "engineer",
    "engineering",
    "software",
    "developer",
    "development",
    "performance",
    "automation",
    "junior",
    "senior",
    "associate",
    "role",
    "roles",
    "job",
    "jobs",
    "about",
    "years",
    "year",
    "open",
    "related",
]);

const tokenizeSearchQuery = (searchQuery: string): string[] =>
    searchQuery
        .toLowerCase()
        .split(/[^a-z0-9+#.]/i)
        .map((token) => token.trim())
        .filter((token) => token.length > 1);

/** Drop semantic near-misses that share no meaningful search tokens with the requested direction. */
export const filterJobsMatchingSearchQuery = (
    searchQuery: string,
    jobs: readonly JobSearchResultItem[],
): JobSearchResultItem[] => {
    const tokens = tokenizeSearchQuery(searchQuery);
    const strongTokens = tokens.filter((token) => !WEAK_DIRECTION_TOKENS.has(token));
    const matchTokens = strongTokens.length > 0 ? strongTokens : tokens;
    if (matchTokens.length === 0) {
        return [...jobs];
    }
    return jobs.filter((job) => {
        const corpus = `${job.title} ${job.description}`.toLowerCase();
        return matchTokens.some((token) => corpus.includes(token));
    });
};
