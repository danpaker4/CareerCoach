export type RequirementRejectReason =
    | "duplicate"
    | "job-ad-text"
    | "company-name"
    | "irrelevant"
    | "low-confidence"
    | "wrong-category"
    | "too-specific"
    | "personal-trait"
    | "years-as-skill";

export type RequirementClass =
    | "FOUNDATION"
    | "TECHNICAL_SKILL"
    | "CYBERSECURITY_DOMAIN"
    | "ARCHITECTURE"
    | "RESPONSIBILITY"
    | "LEADERSHIP"
    | "BUSINESS"
    | "EXPERIENCE"
    | "CERTIFICATION"
    | "EDUCATION"
    | "PERSONAL_TRAIT";

export type CleanedRequirement = {
    readonly sourceText: string;
    readonly normalizedName: string;
    readonly capabilityId: string;
    readonly classification: RequirementClass;
    readonly keep: true;
};

export type RejectedRequirement = {
    readonly input: string;
    readonly reason: RequirementRejectReason;
};

export type MarketCleaningResult = {
    readonly kept: readonly CleanedRequirement[];
    readonly removed: readonly RejectedRequirement[];
};
