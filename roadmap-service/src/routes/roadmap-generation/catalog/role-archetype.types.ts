export type RoleArchetypeId = "executive" | "executive_cyber" | "architecture_ic" | "engineering_ic" | "generic";

export type RoleArchetypeCapability = {
    readonly capabilityId: string;
    readonly label: string;
    readonly category: "technical" | "soft" | "domain" | "leadership" | "architecture" | "responsibility" | "experience";
    readonly requiredLevel: number;
    readonly transitionRelevance: number;
    readonly reasonCode: string;
};
