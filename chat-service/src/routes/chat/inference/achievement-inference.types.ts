export type InferredAchievement = {
    title: string;
    description: string;
    skills: string[];
    inferredSkills: string[];
    confidence: number;
    evidence: string;
};

export type AchievementInferenceResult = {
    achievements: InferredAchievement[];
};
