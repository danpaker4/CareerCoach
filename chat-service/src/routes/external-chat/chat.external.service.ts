import type { JobSearchPlanRequest, JobSearchRequest, JobSearchResultItem, UserAchievementResponse, UserProfileResponse } from "../chat/chat.types";
import { isAchievement, isJobSearchResultItem, normalizeFilters, normalizeJobSearchResultItem, normalizeSearchPlan, parseUserProfileResponse } from "../chat/chat.utils";
import {
    mergeUniqueStrings,
    mergeUserAchievements,
    readUserAchievementsField,
    readUserStringArrayField,
    toAchievementFromMessage,
} from "./chat.external.utils";
import type { ApplyInferredAchievementSignalsParams, ApplyInferredRoleExperienceParams } from "./chat.external.types";
import type { RoleExperienceEntry } from "./role-experience.types";
import { mergeRoleExperience, readUserRoleExperienceField } from "./role-experience.utils";

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

    readUserRoleExperience = async (userId: string): Promise<RoleExperienceEntry[]> => {
        const profile = await this.readUserPublicProfile(userId);
        return profile ? readUserRoleExperienceField(profile) : [];
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

    applyInferredAchievementSignals = async (userId: string, params: ApplyInferredAchievementSignalsParams): Promise<void> => {
        const { technologies, knownSkills, achievements } = params;
        if (technologies.length === 0 && knownSkills.length === 0 && achievements.length === 0) {
            return;
        }

        const profile = await this.readUserPublicProfile(userId);
        if (!profile) {
            return;
        }

        const patchBody: {
            technologies?: string[];
            knownSkills?: string[];
            achievements?: UserAchievementResponse[];
        } = {};

        if (technologies.length > 0) {
            patchBody.technologies = mergeUniqueStrings(readUserStringArrayField(profile, "technologies"), technologies);
        }
        if (knownSkills.length > 0) {
            patchBody.knownSkills = mergeUniqueStrings(readUserStringArrayField(profile, "knownSkills"), knownSkills);
        }
        if (achievements.length > 0) {
            patchBody.achievements = mergeUserAchievements(readUserAchievementsField(profile), achievements);
        }

        await fetch(`${this.usersServiceBaseUrl}/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
        }).catch(() => null);
    };

    applyInferredRoleExperience = async (userId: string, params: ApplyInferredRoleExperienceParams): Promise<void> => {
        const { roleExperience } = params;
        if (roleExperience.length === 0) {
            return;
        }

        const profile = await this.readUserPublicProfile(userId);
        if (!profile) {
            return;
        }

        const mergedRoleExperience = mergeRoleExperience(readUserRoleExperienceField(profile), roleExperience);
        await fetch(`${this.usersServiceBaseUrl}/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleExperience: mergedRoleExperience }),
        }).catch(() => null);
    };
}
