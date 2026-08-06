import type { CareerSignal } from "../../../routes/career-profile/career-profile.types";
import type { SanitizedJob } from "../../../routes/conversation/job-in-conversation.types";
import type { JobFollowUpField, JobSelectionResolution } from "./job-follow-up-answer.types";

export const JOB_FOLLOW_UP_NEW_SEARCH_PATTERNS = [
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
] as const;

export const JOB_FOLLOW_UP_FIELD_PATTERNS: ReadonlyArray<{ field: JobFollowUpField; patterns: readonly string[] }> = [
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

export const JOB_FOLLOW_UP_REFERENCE_PATTERNS = [
    "it",
    "this job",
    "that job",
    "this role",
    "that role",
    "the role",
    "the first one",
    "the second one",
    "the third one",
] as const;

const JOB_SELECTION_ORDINAL_LOOKUP: ReadonlyArray<{ patterns: readonly string[]; index: number }> = [
    { patterns: ["first", "1st"], index: 0 },
    { patterns: ["second", "2nd"], index: 1 },
    { patterns: ["third", "3rd"], index: 2 },
    { patterns: ["fourth", "4th"], index: 3 },
];

export const resolveJobSelectionFromFollowUpMessage = (
    userMessage: string,
    selectedJobSnapshot: SanitizedJob | null,
    lastReturnedJobs: readonly SanitizedJob[]
): JobSelectionResolution => {
    if (selectedJobSnapshot) {
        return { status: "resolved", job: selectedJobSnapshot };
    }

    if (lastReturnedJobs.length === 0) {
        return { status: "missing" };
    }

    if (lastReturnedJobs.length === 1) {
        const firstJob = lastReturnedJobs[0];
        if (!firstJob) {
            return { status: "missing" };
        }
        return { status: "resolved", job: firstJob };
    }

    const normalized = userMessage.toLowerCase();
    const ordinalIndex = JOB_SELECTION_ORDINAL_LOOKUP.find(({ patterns }) =>
        patterns.some((pattern) => normalized.includes(pattern))
    )?.index;
    if (typeof ordinalIndex === "number" && ordinalIndex >= 0 && ordinalIndex < lastReturnedJobs.length) {
        const selectedByOrdinal = lastReturnedJobs[ordinalIndex];
        if (!selectedByOrdinal) {
            return { status: "missing" };
        }
        return { status: "resolved", job: selectedByOrdinal };
    }

    const filteredByCompany = lastReturnedJobs.filter((job) =>
        job.company.trim().length > 0 && normalized.includes(job.company.toLowerCase())
    );
    if (filteredByCompany.length === 1) {
        const companyMatch = filteredByCompany[0];
        if (!companyMatch) {
            return { status: "missing" };
        }
        return { status: "resolved", job: companyMatch };
    }

    const filteredBySeniority = lastReturnedJobs.filter((job) => normalized.includes(job.seniority.toLowerCase()));
    if (filteredBySeniority.length === 1) {
        const seniorityMatch = filteredBySeniority[0];
        if (!seniorityMatch) {
            return { status: "missing" };
        }
        return { status: "resolved", job: seniorityMatch };
    }

    return { status: "ambiguous", options: [...lastReturnedJobs] };
};

/** Lowercase tokens scanned in job descriptions when structured skills are empty. */
const JOB_FOLLOW_UP_DESCRIPTION_TECH_KEYWORDS = [
    "react",
    "node",
    "typescript",
    "javascript",
    "mongodb",
    "sql",
    "python",
    "java",
    "aws",
    "docker",
    "kubernetes",
    "rest",
] as const;

export const JOB_FOLLOW_UP_DISAMBIGUATION_MAX_JOBS = 5;

export const formatFollowUpList = (items: readonly string[]): string =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- Not available";

const extractTechKeywordsFromJobDescription = (description: string): string[] => {
    const loweredDescription = description.toLowerCase();
    return JOB_FOLLOW_UP_DESCRIPTION_TECH_KEYWORDS
        .filter((keyword) => loweredDescription.includes(keyword))
        .map((keyword) => (keyword === "rest" ? "REST APIs" : keyword[0]?.toUpperCase() + keyword.slice(1)));
};

export const toSignalValuesLowercased = (signals: readonly CareerSignal[]): string[] =>
    signals.map((signal) => signal.value.toLowerCase());

export const createFollowUpMissingDataMessage = (fieldName: string): string =>
    `I do not have ${fieldName} for this job in the stored job data.`;

export const collectJobMustKnowSkills = (job: SanitizedJob): string[] => {
    if (job.mustKnowSkills.length > 0) {
        return job.mustKnowSkills;
    }
    if (job.requirements.length > 0) {
        return job.requirements;
    }
    return extractTechKeywordsFromJobDescription(job.description);
};

export const collectJobRequirements = (job: SanitizedJob): string[] => {
    if (job.requirements.length > 0) {
        return job.requirements;
    }
    if (job.mustKnowSkills.length > 0) {
        return job.mustKnowSkills;
    }
    return extractTechKeywordsFromJobDescription(job.description);
};

export const resolveFollowUpEffectiveField = (field: JobFollowUpField | null, message: string): JobFollowUpField => {
    if (field) {
        return field;
    }
    const lowered = message.toLowerCase();
    if (lowered.includes("salary") || lowered.includes("pay")) {
        return "salary";
    }
    if (lowered.includes("company")) {
        return "company";
    }
    if (lowered.includes("seniority") || lowered.includes("junior")) {
        return "seniority";
    }
    return "details";
};
