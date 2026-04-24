export type AchievementDraft = {
  name: string;
  grade: number;
};

export type GeminiAchievementsPayload = {
  achievements: AchievementDraft[];
};
