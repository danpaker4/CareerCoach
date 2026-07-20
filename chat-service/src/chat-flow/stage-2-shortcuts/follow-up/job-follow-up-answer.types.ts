import type { SanitizedJob } from "../../../routes/conversation/job-in-conversation.types";

export type JobFollowUpField =
    | "mustKnowSkills"
    | "requirements"
    | "skillsNeeded"
    | "details"
    | "salary"
    | "seniority"
    | "company"
    | "benefits"
    | "learningPlan"
    | "fitReason"
    | "missingSkills";

export type JobSelectionResolution =
    | { status: "resolved"; job: SanitizedJob }
    | { status: "ambiguous"; options: SanitizedJob[] }
    | { status: "missing" };

export type JobFollowUpIntentResult = {
    isFollowUp: boolean;
    requestedField: JobFollowUpField | null;
    isExplicitNewSearch: boolean;
};
