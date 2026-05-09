import type { CareerSignal, UserCareerProfile } from "../career-profile/career-profile.types";
import type { JobFollowUpField, SanitizedJob } from "./job-context.types";

const formatList = (items: readonly string[]): string =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- Not available";

const extractKeywordsFromDescription = (description: string): string[] => {
    const techKeywords = [
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
    ];
    const loweredDescription = description.toLowerCase();
    return techKeywords
        .filter((keyword) => loweredDescription.includes(keyword))
        .map((keyword) => (keyword === "rest" ? "REST APIs" : keyword[0]?.toUpperCase() + keyword.slice(1)));
};

const toSignalValues = (signals: readonly CareerSignal[]): string[] =>
    signals.map((signal) => signal.value.toLowerCase());

const createMissingDataMessage = (fieldName: string): string =>
    `I do not have ${fieldName} for this job in the stored job data.`;

const collectMustKnowSkills = (job: SanitizedJob): string[] => {
    if (job.mustKnowSkills.length > 0) {
        return job.mustKnowSkills;
    }
    if (job.requirements.length > 0) {
        return job.requirements;
    }
    return extractKeywordsFromDescription(job.description);
};

const collectRequirements = (job: SanitizedJob): string[] => {
    if (job.requirements.length > 0) {
        return job.requirements;
    }
    if (job.mustKnowSkills.length > 0) {
        return job.mustKnowSkills;
    }
    return extractKeywordsFromDescription(job.description);
};

const resolveEffectiveField = (field: JobFollowUpField | null, message: string): JobFollowUpField => {
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

export class JobFollowUpAnswerService {
    buildDisambiguationQuestion = (jobs: readonly SanitizedJob[]): string => {
        const labels = jobs.slice(0, 5).map((job) => `${job.title} at ${job.company || "Unknown company"}`);
        return `Which job do you mean? ${labels.join(", ")}.`;
    };

    buildAnswer = (
        field: JobFollowUpField | null,
        job: SanitizedJob,
        userMessage: string,
        profile: UserCareerProfile
    ): string => {
        const effectiveField = resolveEffectiveField(field, userMessage);
        const titleLine = `${job.title} at ${job.company || "Unknown company"}`;

        if (effectiveField === "mustKnowSkills") {
            const skills = collectMustKnowSkills(job);
            if (skills.length === 0) {
                return createMissingDataMessage("must-know skills");
            }
            return `For ${titleLine}, the must-know skills are:\n${formatList(skills)}`;
        }

        if (effectiveField === "requirements") {
            const requirements = collectRequirements(job);
            if (requirements.length === 0) {
                return createMissingDataMessage("requirements");
            }
            return `For ${titleLine}, the requirements are:\n${formatList(requirements)}`;
        }

        if (effectiveField === "skillsNeeded") {
            const skills = collectMustKnowSkills(job);
            if (skills.length === 0) {
                return createMissingDataMessage("skills");
            }
            return `For ${titleLine}, these skills are needed:\n${formatList(skills)}`;
        }

        if (effectiveField === "salary") {
            if (job.salary === null || job.salary <= 0) {
                return createMissingDataMessage("salary");
            }
            return `For ${titleLine}, the salary in stored data is ${job.salary}.`;
        }

        if (effectiveField === "company") {
            if (!job.company) {
                return createMissingDataMessage("company");
            }
            return `This role is at ${job.company}.`;
        }

        if (effectiveField === "seniority") {
            if (!job.seniority) {
                return createMissingDataMessage("seniority");
            }
            return `This role is marked as ${job.seniority}.`;
        }

        if (effectiveField === "benefits") {
            if (job.benefits.length === 0) {
                return createMissingDataMessage("benefits");
            }
            return `For ${titleLine}, listed benefits are:\n${formatList(job.benefits)}`;
        }

        if (effectiveField === "learningPlan" || effectiveField === "missingSkills") {
            const requirements = collectRequirements(job);
            if (requirements.length === 0) {
                return createMissingDataMessage("requirements");
            }
            const knownSkills = new Set([
                ...toSignalValues(profile.technologies),
                ...toSignalValues(profile.strengths),
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
                `Already relevant skills:\n${formatList(alreadyHave)}`,
                `Missing skills to focus on:\n${formatList(prioritizedMissing)}`,
                `Suggested order: ${prioritizedMissing.length > 0 ? prioritizedMissing.join(" -> ") : "No clear missing skills from the listed requirements."}`,
            ].join("\n\n");
        }

        if (effectiveField === "fitReason") {
            const requirements = collectRequirements(job);
            const knownSkills = new Set([...toSignalValues(profile.technologies), ...toSignalValues(profile.strengths)]);
            const overlap = requirements.filter((item) => knownSkills.has(item.toLowerCase()));
            if (overlap.length === 0) {
                return `This can still fit, but I do not see direct overlap yet in stored profile skills. We can focus on the listed requirements next.`;
            }
            return `This role fits because your profile already overlaps with:\n${formatList(overlap)}`;
        }

        return [
            `Here is what I have for ${titleLine}:`,
            `Seniority: ${job.seniority || "Not available"}`,
            `Description: ${job.description || "Not available"}`,
            `Requirements:\n${formatList(job.requirements)}`,
            `Must-know skills:\n${formatList(job.mustKnowSkills)}`,
            `Nice-to-have skills:\n${formatList(job.niceToHaveSkills)}`,
            `Benefits:\n${formatList(job.benefits)}`,
            `Salary: ${job.salary && job.salary > 0 ? `${job.salary}` : "Not available"}`,
            `URL: ${job.url || "Not available"}`,
        ].join("\n\n");
    };
}
