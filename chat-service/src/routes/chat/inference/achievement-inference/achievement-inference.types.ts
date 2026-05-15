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
    /** Explicit tech names from the message (users `technologies`). */
    skills: string[];
    /** Themes inferred from trigger rules (users `knownSkills`). */
    inferredSkills: string[];
};
