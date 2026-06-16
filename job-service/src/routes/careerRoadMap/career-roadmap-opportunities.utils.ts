import type { Collection } from "mongodb";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import { computeJobScore } from "../jobScores/job-score.service";
import { normalizeRoleCategory } from "../careerKnowledge/career-knowledge.utils";
import { MIN_MATCH_FIT_PCT } from "../jobs/jobs.consts";

export type StageOpportunity = {
    jobId: string;
    title: string;
    company: string;
    seniority: string;
    url: string;
    relevanceReason: string;
};

export type DiscoverOpportunitiesParams = {
    roleCategories: string[];
    userSkills?: string[];
    limit?: number;
};

const buildRelevanceReason = (job: EnrichedJob, roleCategory: string, score: number): string => {
    const normalized = normalizeRoleCategory(job.jobTitle, job.seniority ?? "");
    if (normalized.toLowerCase().includes(roleCategory.toLowerCase().split(" ").slice(-2).join(" "))) {
        return `Title aligns with ${roleCategory} milestone (match score ${score}%).`;
    }
    return `Matches skills and seniority expectations for ${roleCategory} (match score ${score}%).`;
};

export const discoverStageOpportunities = async (
    jobsCollection: Collection<EnrichedJob>,
    params: DiscoverOpportunitiesParams
): Promise<StageOpportunity[]> => {
    const limit = params.limit ?? 8;
    const keywords = params.roleCategories.flatMap((category) => category.split(" ").filter((w) => w.length > 2));
    const uniqueKeywords = [...new Set(keywords)].slice(0, 10);

    const regexPattern = uniqueKeywords.length > 0 ? uniqueKeywords.join("|") : params.roleCategories.join("|");
    const jobs = await jobsCollection
        .find({ jobTitle: { $regex: regexPattern, $options: "i" } }, { limit: 50 })
        .toArray();

    const userSkills = params.userSkills ?? [];
    const scored = jobs
        .map((job) => {
            const scoreResult = userSkills.length > 0
                ? computeJobScore(job, userSkills)
                : { overallScore: 50, categories: [], userSkillsUsed: [] };
            const bestCategory = params.roleCategories.reduce((best, category) => {
                const titleMatch = job.jobTitle.toLowerCase().includes(category.toLowerCase().split(" ").slice(-1)[0] ?? "");
                return titleMatch ? category : best;
            }, params.roleCategories[0] ?? "this stage");
            return {
                job,
                score: scoreResult.overallScore,
                relevanceReason: buildRelevanceReason(job, bestCategory, scoreResult.overallScore),
            };
        })
        .filter((item) => userSkills.length === 0 || item.score >= MIN_MATCH_FIT_PCT)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored.map(({ job, relevanceReason }) => ({
        jobId: job.id,
        title: job.jobTitle,
        company: job.company ?? "",
        seniority: job.seniority ?? "",
        url: job.url ?? "",
        relevanceReason,
    }));
};
