export type CatalogAction = {
    readonly id: string;
    readonly title: string;
    readonly capabilityIds: readonly string[];
    readonly effortHours: number;
    readonly progressionType: "learning" | "experience" | "hybrid";
    readonly minCalendarWeeks?: number;
};

export type CatalogResource = {
    readonly id: string;
    readonly title: string;
    readonly platform: string;
    readonly url: string;
    readonly type: "course" | "video" | "practice" | "article" | "docs" | "repository" | "certification";
    readonly capabilityIds: readonly string[];
    readonly effortHours: number;
    readonly costType?: "free" | "paid" | "free-audit";
    readonly difficulty?: "beginner" | "intermediate" | "advanced";
    readonly lastVerifiedAt?: string;
};

export type StageTemplate = {
    readonly id: string;
    readonly labelPattern: string;
    readonly descriptionPattern: string;
    readonly whyItMattersPattern: string;
    readonly progressionType: "learning" | "experience" | "hybrid";
    readonly categories: readonly string[];
    readonly maxGaps: number;
};
