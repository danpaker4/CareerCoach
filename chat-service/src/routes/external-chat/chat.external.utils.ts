import type { UserAchievementResponse } from "../chat/chat.types";
import { isAchievement } from "../chat/chat.utils";
import { EXPERIENCE_HINTS } from "./chat.external.consts";

export const mergeUniqueStrings = (existing: readonly string[], incoming: readonly string[]): string[] =>
    [...new Set([...existing, ...incoming].map((item) => item.trim()).filter((item) => item.length > 0))];

export const readUserStringArrayField = (profile: Record<string, unknown>, field: string): string[] =>
    Array.isArray(profile[field]) ? profile[field].filter((item): item is string => typeof item === "string") : [];

export const readUserAchievementsField = (profile: Record<string, unknown>): UserAchievementResponse[] =>
    Array.isArray(profile.achievements) ? profile.achievements.filter(isAchievement) : [];

export const mergeUserAchievements = (
    existing: readonly UserAchievementResponse[],
    incoming: readonly UserAchievementResponse[]
): UserAchievementResponse[] => {
    const merged = [...existing];
    incoming.forEach((achievement) => {
        const isDuplicate = merged.some((item) => item.name.toLowerCase() === achievement.name.toLowerCase());
        if (!isDuplicate) {
            merged.push(achievement);
        }
    });
    return merged;
};

export const toAchievementFromMessage = (message: string): UserAchievementResponse | null => {
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
