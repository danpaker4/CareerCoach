import type { UserAchievementResponse } from "../../chat-flow/api/shared/chat.types";
import type { GeneratedStageContent } from "../../chat-flow/stage-2-shortcuts/dream-job/chat.dream-job-roadmap.types";
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
