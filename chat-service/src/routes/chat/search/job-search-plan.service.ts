import type { UserCareerProfile } from "../career-profile/career-profile.types";
import type { JobSearchRequest } from "../chat.types";
import type { JobSearchPlan } from "./job-search-plan.types";

const pickTopValues = (values: readonly { value: string }[], limit: number): string[] =>
    values.slice(0, limit).map((item) => item.value);

export class JobSearchPlanService {
    buildPlan = (profile: UserCareerProfile, baseFilters: JobSearchRequest): JobSearchPlan => {
        const roleKeywords = pickTopValues(profile.preferredRoles, 2);
        const interests = pickTopValues(profile.interests, 3);
        const technologies = pickTopValues(profile.technologies, 4);
        const keywords = [...new Set([...baseFilters.keywords, ...interests, ...roleKeywords])];
        const strictQueryFallback = [...keywords, ...baseFilters.interests, ...baseFilters.skills].join(" ").trim();

        const strictFilters: JobSearchRequest = {
            ...baseFilters,
            skills: [...new Set([...baseFilters.skills, ...technologies])],
            interests: [...new Set([...baseFilters.interests, ...interests])],
            keywords,
        };

        const exploratoryFilters: JobSearchRequest = {
            ...strictFilters,
            keywords: [...new Set([...strictFilters.keywords, ...pickTopValues(profile.motivations, 2)])],
        };

        return {
            searches: [
                {
                    type: "STRICT_MATCH",
                    query: `${roleKeywords.join(" ")} ${technologies.join(" ")}`.trim() || strictQueryFallback,
                    filters: strictFilters,
                },
                {
                    type: "SEMANTIC_PROFILE",
                    query: `${interests.join(" ")} ${pickTopValues(profile.workStyle, 2).join(" ")}`.trim(),
                    filters: strictFilters,
                },
                {
                    type: "EXPLORATORY",
                    query: `roles for ${interests.join(", ") || "career exploration"} with ${technologies.join(", ") || "general technical skills"}`,
                    filters: exploratoryFilters,
                },
            ],
        };
    };
}
