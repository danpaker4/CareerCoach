export type CapabilityHorizon = "short" | "medium" | "long" | "multi_year";

export type RoleArchetypeId = "executive_cyber" | "architecture_ic" | "engineering_ic" | "generic";

export type RoleArchetypeCapability = {
    readonly capabilityId: string;
    readonly label: string;
    readonly category: "technical" | "soft" | "domain" | "leadership" | "architecture" | "responsibility" | "experience";
    readonly requiredLevel: number;
    readonly transitionRelevance: number;
    readonly reasonCode: string;
};
