import type { AchievementInferenceResult, InferredAchievement } from "./achievement-inference.types";
import { ACHIEVEMENT_INFERENCE_RULES, extractExplicitSkills, mergeUniqueStrings } from "./achievement-inference.utils";

export class AchievementInferenceService {
    inferFromMessage = (message: string): AchievementInferenceResult => {
        const lowered = message.toLowerCase();
        const explicit = extractExplicitSkills(message);
        const achievements: InferredAchievement[] = [];

        for (const rule of ACHIEVEMENT_INFERENCE_RULES) {
            if (!rule.trigger.some((trigger) => lowered.includes(trigger))) {
                continue;
            }
            achievements.push({
                title: rule.title,
                description: message,
                skills: explicit,
                inferredSkills: [...rule.inferred],
                confidence: 0.72,
                evidence: message,
            });
        }

        if (achievements.length === 0 && explicit.length > 0) {
            achievements.push({
                title: "Technical skills mentioned",
                description: message,
                skills: explicit,
                inferredSkills: [],
                confidence: 0.65,
                evidence: message,
            });
        }

        return {
            achievements,
            skills: mergeUniqueStrings(achievements.flatMap((item) => item.skills)),
            inferredSkills: mergeUniqueStrings(achievements.flatMap((item) => item.inferredSkills)),
        };
    };
}
