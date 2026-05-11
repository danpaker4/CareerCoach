import type { JobFollowUpField } from "./job-context.types";

const NEW_SEARCH_PATTERNS = [
    "search again",
    "find more jobs",
    "show more jobs",
    "other jobs",
    "different jobs",
    "another role",
    "another job",
    "new search",
    "more options",
    "different company",
];

const FOLLOW_UP_FIELD_PATTERNS: Array<{ field: JobFollowUpField; patterns: string[] }> = [
    { field: "mustKnowSkills", patterns: ["mustknowskills", "must know skills", "must-have skills", "must have skills"] },
    { field: "requirements", patterns: ["requirements", "require", "what does this job require"] },
    { field: "skillsNeeded", patterns: ["what skills do i need", "skills i need", "skills needed"] },
    { field: "details", patterns: ["tell me more", "more about it", "more about this job", "job details", "what is this role"] },
    { field: "salary", patterns: ["salary", "pay", "compensation", "how much"] },
    { field: "seniority", patterns: ["is it junior", "is this junior", "seniority", "junior or senior"] },
    { field: "company", patterns: ["what company", "which company", "who is the company"] },
    { field: "benefits", patterns: ["benefits", "perks"] },
    { field: "learningPlan", patterns: ["what should i learn", "how should i prepare", "how to prepare for it"] },
    { field: "fitReason", patterns: ["why does it fit me", "why this fits me", "why is it good for me"] },
    { field: "missingSkills", patterns: ["what is missing for me", "what am i missing", "missing skills"] },
];

const REFERENCE_PATTERNS = [
    "it",
    "this job",
    "that job",
    "this role",
    "that role",
    "the role",
    "the first one",
    "the second one",
    "the third one",
];

export type JobFollowUpIntentResult = {
    isFollowUp: boolean;
    requestedField: JobFollowUpField | null;
    isExplicitNewSearch: boolean;
};

export class JobFollowUpIntentService {
    detect = (message: string): JobFollowUpIntentResult => {
        const normalized = message.toLowerCase().trim();
        const isExplicitNewSearch = NEW_SEARCH_PATTERNS.some((pattern) => normalized.includes(pattern));
        const fieldMatch = FOLLOW_UP_FIELD_PATTERNS.find(({ patterns }) =>
            patterns.some((pattern) => normalized.includes(pattern))
        )?.field ?? null;
        const hasReference = REFERENCE_PATTERNS.some((pattern) => normalized.includes(pattern));
        const isFollowUp = !isExplicitNewSearch && (fieldMatch !== null || hasReference);

        return {
            isFollowUp,
            requestedField: fieldMatch,
            isExplicitNewSearch,
        };
    };
}
