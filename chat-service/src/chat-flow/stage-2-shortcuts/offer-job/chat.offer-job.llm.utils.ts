import type { JobOfferDraft } from "./chat.offer-job.types";

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const asStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
};

/**
 * Parses the LLM extraction output into a JobOfferDraft.
 * Tolerates leading/trailing prose or markdown fences by slicing the outermost JSON object.
 * Throws when no JSON object can be located so callers can fall back gracefully.
 */
export const parseJobOfferFromJson = (rawText: string): JobOfferDraft => {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("No JSON object found in offer-job extraction");
    }

    const parsed: unknown = JSON.parse(rawText.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Offer-job extraction is not an object");
    }

    const obj = parsed as Record<string, unknown>;
    const salaryRaw = obj.salary;
    const salary =
        typeof salaryRaw === "number" && Number.isFinite(salaryRaw) && salaryRaw > 0
            ? Math.round(salaryRaw)
            : undefined;
    const url = asString(obj.url);

    return {
        jobTitle: asString(obj.jobTitle),
        company: asString(obj.company),
        seniority: asString(obj.seniority),
        location: asString(obj.location),
        requirements: asStringArray(obj.requirements),
        description: asString(obj.description),
        salary,
        url: url.length > 0 ? url : undefined,
    };
};
