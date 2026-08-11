import type { NormalizedPublicJob } from "./import-public-jobs.types";
import {
    htmlToText,
    inferSeniority,
    parseYearlySalary,
    requirementsFromTags,
} from "./import-public-jobs.utils";

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const asRecordArray = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value)
        ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        : [];

export const REMOTIVE_URL = "https://remotive.com/api/remote-jobs";
export const ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api";
export const JOBICY_URL = "https://jobicy.com/api/v2/remote-jobs?count=50";

export const adaptRemotive = (payload: unknown): NormalizedPublicJob[] => {
    const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
    return asRecordArray(root.jobs).map((job) => {
        const title = asString(job.title);
        return {
            jobTitle: title,
            company: asString(job.company_name),
            description: htmlToText(asString(job.description)),
            seniority: inferSeniority(title),
            location: asString(job.candidate_required_location) || "Remote",
            salary: parseYearlySalary(asString(job.salary)),
            requirements: requirementsFromTags(job.tags as unknown[] | undefined),
            url: asString(job.url) || undefined,
            source: "remotive" as const,
        };
    });
};

export const adaptArbeitnow = (payload: unknown): NormalizedPublicJob[] => {
    const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
    return asRecordArray(root.data).map((job) => {
        const title = asString(job.title);
        const remote = job.remote === true;
        return {
            jobTitle: title,
            company: asString(job.company_name),
            description: htmlToText(asString(job.description)),
            seniority: inferSeniority(title),
            location: remote ? "Remote" : asString(job.location) || undefined,
            requirements: requirementsFromTags(job.tags as unknown[] | undefined),
            url: asString(job.url) || undefined,
            source: "arbeitnow" as const,
        };
    });
};

export const adaptJobicy = (payload: unknown): NormalizedPublicJob[] => {
    const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
    return asRecordArray(root.jobs).map((job) => {
        const title = asString(job.jobTitle);
        const salaryMin = typeof job.annualSalaryMin === "number" ? job.annualSalaryMin : undefined;
        const salaryMax = typeof job.annualSalaryMax === "number" ? job.annualSalaryMax : undefined;
        const salary = salaryMin && salaryMax
            ? Math.round((salaryMin + salaryMax) / 2)
            : salaryMin ?? salaryMax;
        return {
            jobTitle: title,
            company: asString(job.companyName),
            description: htmlToText(asString(job.jobDescription) || asString(job.jobExcerpt)),
            seniority: inferSeniority(title, asString(job.jobLevel)),
            location: asString(job.jobGeo) || "Remote",
            salary: typeof salary === "number" && salary > 0 ? Math.round(salary) : undefined,
            requirements: requirementsFromTags(job.jobIndustry as unknown[] | undefined),
            url: asString(job.url) || undefined,
            source: "jobicy" as const,
        };
    });
};
