import type { UserAchievement } from "../../../api/shared/chat.model";
import type { ProfileInput } from "../../../../routes/conversation/conversation.types";

export const buildProfileJobSearchQuery = (params: {
    profile: ProfileInput | undefined;
    userAchievements: readonly UserAchievement[];
}): string => {
    const parts = [
        ...(params.profile?.knownSkills ?? []),
        ...(params.profile?.technologies ?? []),
        ...(params.profile?.githubSkills ?? []),
        ...params.userAchievements.map((item) => item.name),
        params.profile?.currentJob,
    ]
        .map((value) => value?.trim())
        .filter((value): value is string => typeof value === "string" && value.length > 0);

    const unique = [...new Set(parts.map((part) => part.toLowerCase()))];
    if (unique.length === 0) {
        return "software engineer";
    }
    return unique.slice(0, 8).join(" ");
};
