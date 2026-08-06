import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { SanitizedJob } from "../../../routes/conversation/job-in-conversation.types";
import type { JobFollowUpField, JobFollowUpIntentResult } from "./job-follow-up-answer.types";
import {
    collectJobMustKnowSkills,
    collectJobRequirements,
    createFollowUpMissingDataMessage,
    formatFollowUpList,
    JOB_FOLLOW_UP_DISAMBIGUATION_MAX_JOBS,
    JOB_FOLLOW_UP_FIELD_PATTERNS,
    JOB_FOLLOW_UP_NEW_SEARCH_PATTERNS,
    JOB_FOLLOW_UP_REFERENCE_PATTERNS,
    resolveFollowUpEffectiveField,
    toSignalValuesLowercased,
} from "./job-follow-up-answer.utils";

export const detectFollowUpIntent = (message: string): JobFollowUpIntentResult => {
    const normalized = message.toLowerCase().trim();
    const isExplicitNewSearch = JOB_FOLLOW_UP_NEW_SEARCH_PATTERNS.some((pattern) => normalized.includes(pattern));
    const fieldMatch = JOB_FOLLOW_UP_FIELD_PATTERNS.find(({ patterns }) =>
        patterns.some((pattern) => normalized.includes(pattern))
    )?.field ?? null;
    const hasReference = JOB_FOLLOW_UP_REFERENCE_PATTERNS.some((pattern) => normalized.includes(pattern));
    const isFollowUp = !isExplicitNewSearch && (fieldMatch !== null || hasReference);

    return {
        isFollowUp,
        requestedField: fieldMatch,
        isExplicitNewSearch,
    };
};

export const buildDisambiguationQuestion = (jobs: readonly SanitizedJob[]): string => {
    const labels = jobs
        .slice(0, JOB_FOLLOW_UP_DISAMBIGUATION_MAX_JOBS)
        .map((job) => `${job.title} at ${job.company || "Unknown company"}`);
    return `Which job do you mean? ${labels.join(", ")}.`;
};

export const buildFollowUpAnswer = (
    field: JobFollowUpField | null,
    job: SanitizedJob,
    userMessage: string,
    profile: UserCareerProfile
): string => {
    const effectiveField = resolveFollowUpEffectiveField(field, userMessage);
    const titleLine = `${job.title} at ${job.company || "Unknown company"}`;

    if (effectiveField === "mustKnowSkills") {
        const skills = collectJobMustKnowSkills(job);
        if (skills.length === 0) {
            return createFollowUpMissingDataMessage("must-know skills");
        }
        return `For ${titleLine}, the must-know skills are:\n${formatFollowUpList(skills)}`;
    }

    if (effectiveField === "requirements") {
        const requirements = collectJobRequirements(job);
        if (requirements.length === 0) {
            return createFollowUpMissingDataMessage("requirements");
        }
        return `For ${titleLine}, the requirements are:\n${formatFollowUpList(requirements)}`;
    }

    if (effectiveField === "skillsNeeded") {
        const skills = collectJobMustKnowSkills(job);
        if (skills.length === 0) {
            return createFollowUpMissingDataMessage("skills");
        }
        return `For ${titleLine}, these skills are needed:\n${formatFollowUpList(skills)}`;
    }

    if (effectiveField === "salary") {
        if (job.salary === null || job.salary <= 0) {
            return createFollowUpMissingDataMessage("salary");
        }
        return `For ${titleLine}, the salary in stored data is ${job.salary}.`;
    }

    if (effectiveField === "company") {
        if (!job.company) {
            return createFollowUpMissingDataMessage("company");
        }
        return `This role is at ${job.company}.`;
    }

    if (effectiveField === "seniority") {
        if (!job.seniority) {
            return createFollowUpMissingDataMessage("seniority");
        }
        return `This role is marked as ${job.seniority}.`;
    }

    if (effectiveField === "benefits") {
        if (job.benefits.length === 0) {
            return createFollowUpMissingDataMessage("benefits");
        }
        return `For ${titleLine}, listed benefits are:\n${formatFollowUpList(job.benefits)}`;
    }

    if (effectiveField === "learningPlan" || effectiveField === "missingSkills") {
        const requirements = collectJobRequirements(job);
        if (requirements.length === 0) {
            return createFollowUpMissingDataMessage("requirements");
        }
        const knownSkills = new Set([
            ...toSignalValuesLowercased(profile.technologies),
            ...toSignalValuesLowercased(profile.strengths),
            ...profile.interests.map((signal) => signal.value.toLowerCase()),
        ]);
        const normalizedRequirements = requirements.map((item) => item.toLowerCase());
        const alreadyHave = requirements.filter((item) =>
            knownSkills.has(item.toLowerCase())
            || knownSkills.has(item.toLowerCase().replace(/\s+/g, " "))
        );
        const missing = requirements.filter((item) => !alreadyHave.includes(item));
        const prioritizedMissing = [...missing].sort(
            (a, b) => normalizedRequirements.indexOf(a.toLowerCase()) - normalizedRequirements.indexOf(b.toLowerCase())
        );

        return [
            `For ${titleLine}, here is a practical learning plan from the stored job data:`,
            `Already relevant skills:\n${formatFollowUpList(alreadyHave)}`,
            `Missing skills to focus on:\n${formatFollowUpList(prioritizedMissing)}`,
            `Suggested order: ${prioritizedMissing.length > 0 ? prioritizedMissing.join(" -> ") : "No clear missing skills from the listed requirements."}`,
        ].join("\n\n");
    }

    if (effectiveField === "fitReason") {
        const requirements = collectJobRequirements(job);
        const knownSkills = new Set([
            ...toSignalValuesLowercased(profile.technologies),
            ...toSignalValuesLowercased(profile.strengths),
        ]);
        const overlap = requirements.filter((item) => knownSkills.has(item.toLowerCase()));
        if (overlap.length === 0) {
            return `This can still fit, but I do not see direct overlap yet in stored profile skills. We can focus on the listed requirements next.`;
        }
        return `This role fits because your profile already overlaps with:\n${formatFollowUpList(overlap)}`;
    }

    return [
        `Here is what I have for ${titleLine}:`,
        `Seniority: ${job.seniority || "Not available"}`,
        `Description: ${job.description || "Not available"}`,
        `Requirements:\n${formatFollowUpList(job.requirements)}`,
        `Must-know skills:\n${formatFollowUpList(job.mustKnowSkills)}`,
        `Nice-to-have skills:\n${formatFollowUpList(job.niceToHaveSkills)}`,
        `Benefits:\n${formatFollowUpList(job.benefits)}`,
        `Salary: ${job.salary && job.salary > 0 ? `${job.salary}` : "Not available"}`,
        `URL: ${job.url || "Not available"}`,
    ].join("\n\n");
};
