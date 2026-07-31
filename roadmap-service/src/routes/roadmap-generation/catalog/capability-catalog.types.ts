export type CapabilityId = string;

export type CapabilityCategory =
    | "technical"
    | "soft"
    | "domain"
    | "leadership"
    | "architecture"
    | "responsibility"
    | "experience"
    | "credential";

export type CapabilityDefinition = {
    readonly id: CapabilityId;
    readonly label: string;
    readonly category: CapabilityCategory;
    readonly aliases: readonly string[];
    readonly dependsOn: readonly CapabilityId[];
    /** Floor for calendar duration when this capability is a stage focus. */
    readonly minCalendarWeeks?: number;
};

export type NormalizedCapability = {
    readonly id: CapabilityId;
    readonly label: string;
    readonly category: CapabilityCategory;
    readonly sourceText: string;
};
