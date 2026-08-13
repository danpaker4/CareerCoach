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
    description: string;
    requirements: string[];
    missingRequirements: string[];
    matchPct: number;
    fit: "apply-now" | "target";
};

export type DiscoverOpportunitiesParams = {
    roleCategories: string[];
    userSkills?: string[];
    page?: number;
    pageSize?: number;
};

export type StageOpportunityPage = {
    opportunities: StageOpportunity[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ROLE_ALIASES: Readonly<Record<string, readonly string[]>> = {
    ceo: ["chief executive officer", "founder", "general manager"],
    "chief executive officer": ["ceo", "founder", "general manager"],
    "engineering manager": ["software engineering manager", "development manager", "team lead"],
    "team lead": ["engineering lead", "technical lead", "manager"],
};

const buildRoleSearchTerms = (roles: readonly string[]): string[] => {
    const terms = roles.flatMap((role) => {
        const fragments = role
            .split(/\s*[|/]\s*|\s+or\s+/i)
            .map((fragment) => fragment.replace(/\([^)]*\)/g, "").trim())
            .filter(Boolean);
        const aliases = fragments.flatMap((fragment) => {
            const normalized = fragment.toLowerCase();
            return Object.entries(ROLE_ALIASES).flatMap(([key, values]) => normalized.includes(key) ? [key, ...values] : []);
        });
        return [role.trim(), ...fragments, ...aliases];
    });
    return [...new Set(terms.filter(Boolean))];
};

const readStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];

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
): Promise<StageOpportunityPage> => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const regexPattern = buildRoleSearchTerms(params.roleCategories).map(escapeRegex).join("|");
    const jobs = await jobsCollection
        .find({ jobTitle: { $regex: regexPattern, $options: "i" } })
        .limit(250)
        .toArray();

    const userSkills = params.userSkills ?? [];
    const normalizedUserSkills = userSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean);
    const scored = jobs
        .map((job) => {
            const requirements = readStringArray(job.requirements);
            const mustKnowSkills = readStringArray(job.mustKnowSkills);
            const scoringJob: EnrichedJob = {
                ...job,
                requirements,
                mustKnowSkills,
                niceToHaveSkills: readStringArray(job.niceToHaveSkills),
                languages: readStringArray(job.languages),
                frameworks: readStringArray(job.frameworks),
                databases: readStringArray(job.databases),
                platforms: readStringArray(job.platforms),
                tools: readStringArray(job.tools),
            };
            const scoreResult = userSkills.length > 0
                ? computeJobScore(scoringJob, userSkills)
                : { overallScore: 50, categories: [], userSkillsUsed: [] };
            const bestCategory = params.roleCategories.reduce((best, category) => {
                const titleMatch = job.jobTitle.toLowerCase().includes(category.toLowerCase().split(" ").slice(-1)[0] ?? "");
                return titleMatch ? category : best;
            }, params.roleCategories[0] ?? "this stage");
            return {
                job,
                score: scoreResult.overallScore,
                relevanceReason: buildRelevanceReason(job, bestCategory, scoreResult.overallScore),
                requirements,
                missingRequirements: [...mustKnowSkills, ...requirements]
                    .filter((requirement, index, all) => all.indexOf(requirement) === index)
                    .filter((requirement) => {
                        const normalizedRequirement = requirement.trim().toLowerCase();
                        return !normalizedUserSkills.some((skill) =>
                            normalizedRequirement.includes(skill) || skill.includes(normalizedRequirement)
                        );
                    })
                    .slice(0, 6),
            };
        })
        .sort((a, b) => b.score - a.score);

    const total = scored.length;
    const opportunities = scored.slice((page - 1) * pageSize, page * pageSize).map(({ job, relevanceReason, score, requirements, missingRequirements }) => ({
        jobId: job.id,
        title: job.jobTitle,
        company: job.company ?? "",
        seniority: job.seniority ?? "",
        url: job.url ?? "",
        relevanceReason,
        description: job.description ?? "",
        requirements,
        missingRequirements,
        matchPct: score,
        fit: userSkills.length > 0 && score >= MIN_MATCH_FIT_PCT ? "apply-now" as const : "target" as const,
    }));
    return {
        opportunities,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
};
