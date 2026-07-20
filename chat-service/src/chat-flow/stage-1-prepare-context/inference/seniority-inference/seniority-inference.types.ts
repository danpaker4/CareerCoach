import type { RoleSeniorityLevel } from "../../../../routes/external-chat-tools/role-experience.types";

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

export type RoleDomainDefinition = {
    roleKey: string;
    displayLabel: string;
    messageAliases: readonly string[];
    jobTitleKeywords: readonly string[];
};
