import type { UserAchievementResponse } from "../chat/chat.types";
import type { GeneratedStageContent } from "../chat/dream-job/chat.dream-job-roadmap.types";
import type { RoleExperienceEntry } from "./role-experience.types";

export type ApplyInferredRoleExperienceParams = {
    roleExperience: readonly RoleExperienceEntry[];
};

export type ApplyInferredAchievementSignalsParams = {
    technologies: readonly string[];
    knownSkills: readonly string[];
    achievements: readonly UserAchievementResponse[];
};

export type CreateCareerRoadmapStage = {
    jobId: number;
    isDone: boolean;
    content?: GeneratedStageContent;
};

export type CreateCareerRoadmapParams = {
    userId: string;
    dreamJob: string;
    stagesToDreamJob: readonly CreateCareerRoadmapStage[];
    generatedAt?: Date;
};
