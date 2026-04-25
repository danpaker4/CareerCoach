import type { JobSearchRequest, JobSearchResultItem, UserAchievementResponse, UserProfileResponse } from "../../chat.types";
import { isAchievement, isJobSearchResultItem, normalizeFilters, parseUserProfileResponse } from "../chat.utils";
import { EXPERIENCE_HINTS } from "./chat.external.consts";

const toAchievementFromMessage = (message: string): UserAchievementResponse | null => {
    const normalized = message.trim().replace(/\s+/g, " ");
    if (normalized.length < 20) {
        return null;
    }

    const lowered = normalized.toLowerCase();
    const hasExperienceSignal = EXPERIENCE_HINTS.some((hint) => lowered.includes(hint));
    if (!hasExperienceSignal) {
        return null;
    }

    const name = normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
    return {
        id: crypto.randomUUID(),
        name,
        grade: 70,
    };
};

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

    upsertAchievementFromUserMessage = async (
        userId: string,
        message: string,
        currentAchievements: readonly UserAchievementResponse[]
    ): Promise<UserAchievementResponse[] | null> => {
        const nextAchievement = toAchievementFromMessage(message);
        if (!nextAchievement) {
            return null;
        }

        const hasDuplicate = currentAchievements.some(
            (achievement) => achievement.name.toLowerCase() === nextAchievement.name.toLowerCase()
        );
        if (hasDuplicate) {
            return null;
        }

        const updatedAchievements = [...currentAchievements, nextAchievement];
        const response = await fetch(`${this.usersServiceBaseUrl}/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ achievements: updatedAchievements }),
        });

        if (!response.ok) {
            return null;
        }

        return updatedAchievements;
    };
}
