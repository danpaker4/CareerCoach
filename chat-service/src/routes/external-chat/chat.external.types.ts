import type { UserAchievementResponse } from "../chat/chat.types";
import type { RoleExperienceEntry } from "./role-experience.types";

export type ApplyInferredRoleExperienceParams = {
    roleExperience: readonly RoleExperienceEntry[];
};

export type ApplyInferredAchievementSignalsParams = {
    technologies: readonly string[];
    knownSkills: readonly string[];
    achievements: readonly UserAchievementResponse[];
};
