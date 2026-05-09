import type { SanitizedJob } from "./job-context.types";

const ORDINAL_LOOKUP: Array<{ patterns: string[]; index: number }> = [
    { patterns: ["first", "1st"], index: 0 },
    { patterns: ["second", "2nd"], index: 1 },
    { patterns: ["third", "3rd"], index: 2 },
    { patterns: ["fourth", "4th"], index: 3 },
];

type JobSelectionResolved = {
    status: "resolved";
    job: SanitizedJob;
};

type JobSelectionAmbiguous = {
    status: "ambiguous";
    options: SanitizedJob[];
};

type JobSelectionMissing = {
    status: "missing";
};

export type JobSelectionResolution = JobSelectionResolved | JobSelectionAmbiguous | JobSelectionMissing;

export class JobSelectionResolverService {
    resolve = (
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
        const ordinalIndex = ORDINAL_LOOKUP.find(({ patterns }) => patterns.some((pattern) => normalized.includes(pattern)))?.index;
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
}
