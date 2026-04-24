import type { JobSearchRequest, JobSearchResultItem, UserAchievementResponse } from "./chat.types";

type UserProfileResponse = {
    achievements?: UserAchievementResponse[];
};

const isAchievement = (value: unknown): value is UserAchievementResponse => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    return (
        "id" in value &&
        "name" in value &&
        "grade" in value &&
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.grade === "number"
    );
};

const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const normalizeFilters = (filters: JobSearchRequest): JobSearchRequest => ({
    skills: toStringArray(filters.skills),
    interests: toStringArray(filters.interests),
    experienceLevel: typeof filters.experienceLevel === "string" ? filters.experienceLevel : "",
    keywords: toStringArray(filters.keywords),
});

const isJobSearchResultItem = (value: unknown): value is JobSearchResultItem => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    return (
        "jobId" in value &&
        "jobTitle" in value &&
        "url" in value &&
        "seniority" in value &&
        "description" in value &&
        typeof value.jobId === "string" &&
        typeof value.jobTitle === "string" &&
        typeof value.url === "string" &&
        typeof value.seniority === "string" &&
        typeof value.description === "string"
    );
};

export class ChatExternalService {
    constructor(private readonly usersServiceBaseUrl: string, private readonly jobServiceBaseUrl: string) {}

    readUserAchievements = async (userId: string): Promise<UserAchievementResponse[]> => {
        const achievementsResponse = await fetch(`${this.usersServiceBaseUrl}/users/${userId}/achievements`);
        if (achievementsResponse.ok) {
            const payload: unknown = await achievementsResponse.json().catch(() => []);
            if (Array.isArray(payload)) {
                return payload.filter(isAchievement);
            }
        }

        const profileResponse = await fetch(`${this.usersServiceBaseUrl}/users/${userId}`);
        if (!profileResponse.ok) {
            return [];
        }

        const payload: unknown = await profileResponse.json().catch(() => null);
        if (typeof payload !== "object" || payload === null) {
            return [];
        }

        const achievements = (payload as UserProfileResponse).achievements;
        return Array.isArray(achievements) ? achievements.filter(isAchievement) : [];
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
