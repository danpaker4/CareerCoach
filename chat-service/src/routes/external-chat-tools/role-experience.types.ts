export type RoleSeniorityLevel = "junior" | "mid" | "senior" | "lead";

export type RoleExperienceSource = "cv" | "chat" | "job_interaction" | "llm_inference";

/** Per role-family experience stored on the user document. */
export type RoleExperienceEntry = {
    roleKey: string;
    displayLabel: string;
    years: number;
    level: RoleSeniorityLevel;
    evidence: string[];
    source: RoleExperienceSource;
    updatedAt: Date;
};
