import type { CareerProfileSignalUpdate } from "../../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../routes/external-chat-tools/role-experience.types";
import type { ChatFlowDeps } from "../chat-flow.types";
import { toSignal } from "../api/shared/chat.utils";
import type { AchievementInferenceResult } from "./inference/achievement-inference/achievement-inference.types";
import { toUserAchievementFromInferred } from "./inference/achievement-inference/achievement-inference.utils";

export const toSignalUpdateFromInferences = (
    message: string,
    achievementSkills: readonly string[],
    inferredSkills: readonly string[]
): CareerProfileSignalUpdate => ({
    strengths: inferredSkills.map((skill) => toSignal(skill, 0.7, message, "llm_inference")),
    technologies: achievementSkills.map((skill) => toSignal(skill, 0.86, message, "chat")),
    extractedKeywords: [...achievementSkills, ...inferredSkills]
        .map((keyword) => toSignal(keyword, 0.6, message, "llm_inference")),
});

export const updateUserAchievements = async (
    deps: ChatFlowDeps,
    userId: string,
    achievementInference: AchievementInferenceResult
): Promise<void> => {
    await deps.externalService
        .applyInferredAchievementSignals(userId, {
            technologies: achievementInference.skills,
            knownSkills: achievementInference.inferredSkills,
            achievements: achievementInference.achievements.map(toUserAchievementFromInferred),
        })
        .catch(() => null);
};

export const updateUserRoleExperience = async (
    deps: ChatFlowDeps,
    userId: string,
    roleExperience: readonly RoleExperienceEntry[]
): Promise<void> => {
    await deps.externalService.applyInferredRoleExperience(userId, { roleExperience }).catch(() => null);
};
