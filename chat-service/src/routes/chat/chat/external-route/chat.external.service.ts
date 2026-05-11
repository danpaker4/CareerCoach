import type { JobSearchPlanRequest, JobSearchRequest, JobSearchResultItem, UserAchievementResponse, UserProfileResponse } from "../../chat.types";
import { isAchievement, isJobSearchResultItem, normalizeFilters, normalizeJobSearchResultItem, normalizeSearchPlan, parseUserProfileResponse } from "../chat.utils";
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
        return Array.isArray(payload)
            ? payload
                .filter(isJobSearchResultItem)
                .map(normalizeJobSearchResultItem)
                .slice(0, 10)
            : [];
    };

    searchJobsByPlan = async (plan: JobSearchPlanRequest): Promise<JobSearchResultItem[]> => {
        const response = await fetch(`${this.jobServiceBaseUrl}/jobs/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalizeSearchPlan(plan)),
        });

        if (!response.ok) {
            return [];
        }

        const payload: unknown = await response.json().catch(() => []);
        return Array.isArray(payload)
            ? payload
                .filter(isJobSearchResultItem)
                .map(normalizeJobSearchResultItem)
                .slice(0, 30)
            : [];
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

    readUserPublicProfile = async (userId: string): Promise<Record<string, unknown> | null> => {
        const response = await fetch(`${this.usersServiceBaseUrl}/users/${userId}`);
        if (!response.ok) {
            return null;
        }
        const payload: unknown = await response.json().catch(() => null);
        if (typeof payload !== "object" || payload === null) {
            return null;
        }
        const record = { ...(payload as Record<string, unknown>) };
        delete record.password;
        return record;
    };

    /** Links users `id` to chat career profile by setting `coachProfileMaterializedAt` on the user document. */
    notifyCoachProfileMaterialized = async (userId: string): Promise<void> => {
        await fetch(`${this.usersServiceBaseUrl}/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coachProfileMaterializedAt: new Date().toISOString() }),
        }).catch(() => null);
    };

    upsertKnownSkills = async (userId: string, skills: readonly string[]): Promise<void> => {
        const normalized = [...new Set(skills.map((item) => item.trim()).filter((item) => item.length > 0))];
        if (normalized.length === 0) {
            return;
        }
        await fetch(`${this.usersServiceBaseUrl}/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ knownSkills: normalized }),
        }).catch(() => null);
    };
}
