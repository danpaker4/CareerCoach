import type { UserAchievementResponse } from "../chat/chat.types";

export type ApplyInferredAchievementSignalsParams = {
    technologies: readonly string[];
    knownSkills: readonly string[];
    achievements: readonly UserAchievementResponse[];
};
