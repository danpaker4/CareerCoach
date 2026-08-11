import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../../routes/external-chat-tools/role-experience.types";
import type { JobSearchRequest } from "../../api/shared/chat.types";
import type { JobSearchPlan } from "./job-search-plan.types";

const pickTopValues = (values: readonly { value: string }[], limit: number): string[] =>
    values.slice(0, limit).map((item) => item.value);

/** Near-term / explicit direction search: only the requested role, no profile-tech dilution. */
export const buildStrictDirectionSearchPlan = (directionFilters: JobSearchRequest): JobSearchPlan => {
    const queryTerms = [...directionFilters.keywords, ...directionFilters.skills, ...directionFilters.interests]
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    const query = [...new Set(queryTerms)].join(" ").trim();
    return {
        searches: [
            {
                type: "STRICT_MATCH",
                query: query.length > 0 ? query : "open roles",
                filters: {
                    skills: [],
                    interests: directionFilters.interests,
                    experienceLevel: directionFilters.experienceLevel,
                    keywords: directionFilters.keywords,
                },
            },
        ],
    };
};

export const buildJobSearchPlan = (
    profile: UserCareerProfile,
    baseFilters: JobSearchRequest,
    roleExperience: readonly RoleExperienceEntry[] = []
): JobSearchPlan => {
    const roleKeywords = pickTopValues(profile.preferredRoles, 2);
    const interests = pickTopValues(profile.interests, 3);
    const technologies = pickTopValues(profile.technologies, 4);
    const keywords = [...new Set([...baseFilters.keywords, ...interests, ...roleKeywords])];
    const strictQueryFallback = [...keywords, ...baseFilters.interests, ...baseFilters.skills].join(" ").trim();

    // The role the user explicitly asked for must drive the strict search — not their profile.
    const requestedQuery = [...baseFilters.keywords, ...baseFilters.skills, ...baseFilters.interests]
        .map((term) => term.trim())
        .filter((term) => term.length > 0)
        .join(" ");
    const profileQuery = `${roleKeywords.join(" ")} ${technologies.join(" ")}`.trim();
    const strictQuery = requestedQuery.length > 0 ? requestedQuery : (profileQuery || strictQueryFallback);

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
                query: strictQuery,
                filters: strictFilters,
            },
            {
                type: "SEMANTIC_PROFILE",
                query: `${interests.join(" ")} ${roleExperience.map((item) => item.displayLabel).slice(0, 2).join(" ")}`.trim(),
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

export const buildBroaderJobSearchPlan = (
    profile: UserCareerProfile,
    baseFilters: JobSearchRequest,
    roleExperience: readonly RoleExperienceEntry[] = []
): JobSearchPlan => {
    const basePlan = buildJobSearchPlan(profile, baseFilters, roleExperience);
    const adjacentKeywords = [
        ...baseFilters.keywords,
        "entry level",
        "junior",
        "associate",
        "beginner-friendly",
        "adjacent",
        "related",
        "alternative",
    ];
    const adjacentFilters: JobSearchRequest = {
        ...baseFilters,
        keywords: [...new Set(adjacentKeywords.map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0))],
        interests: [...new Set([...baseFilters.interests, "career exploration", "adjacent roles"])],
        skills: baseFilters.skills,
        experienceLevel: baseFilters.experienceLevel,
    };
    const adjacentQuery = `Entry-friendly and adjacent roles related to: ${baseFilters.keywords.join(" ")}`.trim();
    return {
        searches: [
            {
                type: "ADJACENT",
                query: adjacentQuery.length > 0 ? adjacentQuery : "Related roles and adjacent career paths",
                filters: adjacentFilters,
            },
            ...basePlan.searches,
        ],
    };
};
