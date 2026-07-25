export type ProfileInputLlmExtraction = {
    readonly technologies: readonly string[];
    readonly interests: readonly string[];
    readonly preferredRoles: readonly string[];
    readonly softSkills: readonly string[];
    readonly strengths: readonly string[];
    readonly motivations: readonly string[];
    readonly shortTermGoals: readonly string[];
    readonly longTermGoals: readonly string[];
    readonly extractedKeywords: readonly string[];
    readonly locationPreference: string | null;
    readonly uncertaintyLevel: number | null;
};
