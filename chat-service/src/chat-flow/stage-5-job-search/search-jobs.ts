import type { JobSearchRequest, JobSearchResultItem } from "../api/shared/chat.types";
import type { UserCareerProfile } from "../../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../routes/external-chat-tools/role-experience.types";
import type { ChatExternalService } from "../../routes/external-chat-tools/chat.external.service";
import { buildBroaderJobSearchPlan, buildJobSearchPlan } from "./search-plan/job-search-plan.service";

export const searchJobsWithBroaderFallback = async (params: {
    externalService: ChatExternalService;
    userCareerProfile: UserCareerProfile;
    userRoleExperience: RoleExperienceEntry[];
    searchFilters: JobSearchRequest;
    userId: string;
    trigger: string;
}): Promise<JobSearchResultItem[]> => {
    const { externalService, userCareerProfile, userRoleExperience, searchFilters, userId, trigger } = params;
    const searchPlan = buildJobSearchPlan(userCareerProfile, searchFilters, userRoleExperience);
    console.info(
        `[CHAT][SEARCH] userId=${userId} trigger=${trigger} planSearches=${searchPlan.searches.length} plan=${JSON.stringify(searchPlan.searches.map((item) => ({ type: item.type, query: item.query })))}`
    );
    let jobs = await externalService.searchJobsByPlan(searchPlan);
    console.info(`[CHAT][SEARCH] userId=${userId} trigger=${trigger} results=${jobs.length}`);

    if (jobs.length === 0) {
        console.info(`[CHAT][SEARCH] userId=${userId} trigger=${trigger} broader search fallback`);
        const broaderPlan = buildBroaderJobSearchPlan(userCareerProfile, searchFilters, userRoleExperience);
        jobs = await externalService.searchJobsByPlan(broaderPlan);
    }

    return jobs;
};
