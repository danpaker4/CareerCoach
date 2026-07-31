import type { CapabilityCategory, CapabilityId } from "../catalog/capability-catalog.types";

export type CapabilityEvidence = {
    readonly source: "profile" | "careerProfile" | "github" | "market" | "path" | "inferred";
    readonly detail: string;
};

export type UserCapability = {
    readonly capabilityId: CapabilityId;
    readonly label: string;
    readonly category: CapabilityCategory;
    readonly currentLevel: number;
    readonly confidence: number;
    readonly evidence: readonly CapabilityEvidence[];
};

export type RoleRequirement = {
    readonly capabilityId: CapabilityId;
    readonly label: string;
    readonly category: CapabilityCategory;
    readonly requiredLevel: number;
    readonly marketImportance: number;
    readonly frequency: number;
    readonly requirementStrength: number;
    readonly sourceConfidence: number;
    readonly reasonCodes: readonly string[];
};

export type CapabilityGap = {
    readonly gapId: string;
    readonly capabilityId: CapabilityId;
    readonly label: string;
    readonly category: CapabilityCategory;
    readonly requiredLevel: number;
    readonly currentLevel: number;
    readonly gapScore: number;
    readonly marketImportance: number;
    readonly transitionRelevance: number;
    readonly dependencyWeight: number;
    readonly confidence: number;
    readonly priorityScore: number;
    readonly reasonCodes: readonly string[];
};

export type StructuredGapAnalysis = {
    readonly gaps: readonly CapabilityGap[];
    readonly roleRequirements: readonly RoleRequirement[];
    readonly userCapabilities: readonly UserCapability[];
};
