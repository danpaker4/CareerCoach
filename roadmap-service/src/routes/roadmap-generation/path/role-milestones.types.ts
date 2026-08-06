export type RoleMilestone = {
    readonly id: string;
    readonly label: string;
    /** How the user reaches this stage in plain language. */
    readonly howToGetThere: string;
    /** What tangible outcomes / proof this stage produces. */
    readonly whatYouGain: string;
    readonly whyItMatters: string;
    readonly targetRole: string;
    readonly progressionType: "learning" | "experience" | "hybrid";
    readonly capabilityIds: readonly string[];
    readonly actions: readonly string[];
    readonly completionCriteria: readonly string[];
    readonly minMonths: number;
    readonly maxMonths: number;
};

export type RoleMilestonePlan = {
    readonly milestones: readonly RoleMilestone[];
    readonly reasonCodes: readonly string[];
};
