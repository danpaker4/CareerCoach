import type { RoleSeniorityLevel } from "../../../external-chat/role-experience.types";

export type InferredRoleExperience = {
    roleKey: string;
    displayLabel: string;
    years: number;
    level: RoleSeniorityLevel;
    evidence: string;
};

export type SeniorityInferenceResult = {
    entries: InferredRoleExperience[];
};
