import type { JobSearchRequest, JobSearchResultItem, UserAchievementResponse, UserProfileResponse } from "../../chat.types";
import { isAchievement, isJobSearchResultItem, normalizeFilters, parseUserProfileResponse } from "../chat.utils";

export class ChatExternalService {
    constructor(private readonly usersServiceBaseUrl: string, private readonly jobServiceBaseUrl: string) { }

    readUserAchievements = async (userId: string): Promise<UserAchievementResponse[]> => {
        const achievementsResponse = await fetch(`${this.usersServiceBaseUrl}/users/${userId}/achievements`);
        if (achievementsResponse.ok) {
            const payload: unknown = await achievementsResponse.json().catch(() => []);
            if (Array.isArray(payload)) {
                return payload.filter(isAchievement);
            }
        }

        const profileResponse = await fetch(`${this.usersServiceBaseUrl}/users/${userId}`);
        if (!profileResponse.ok) { return []; }
        const payload: unknown = await profileResponse.json().catch(() => null);
        const parsedProfile: UserProfileResponse | null = parseUserProfileResponse(payload);
        
        return parsedProfile?.achievements?.filter(isAchievement) ?? [];
    };

    searchJobs = async (filters: JobSearchRequest): Promise<JobSearchResultItem[]> => {
        const response = await fetch(`${this.jobServiceBaseUrl}/jobs/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalizeFilters(filters)),
        });

        if (!response.ok) {
            return [];
        }

        const payload: unknown = await response.json().catch(() => []);
        return Array.isArray(payload) ? payload.filter(isJobSearchResultItem).slice(0, 10) : [];
    };
}
