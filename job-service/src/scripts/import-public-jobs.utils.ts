import type { NormalizedPublicJob, PublicJobSource } from "./import-public-jobs.types";

const SENIORITY_PATTERNS: ReadonlyArray<{ readonly seniority: string; readonly pattern: RegExp }> = [
    { seniority: "intern", pattern: /\b(intern|internship|student)\b/i },
    { seniority: "junior", pattern: /\b(junior|jr\.?|entry[- ]level|graduate|associate)\b/i },
    { seniority: "manager", pattern: /\b(manager|head of|director|vp\b|chief)\b/i },
    { seniority: "principal", pattern: /\bprincipal\b/i },
    { seniority: "staff", pattern: /\bstaff\b/i },
    { seniority: "senior", pattern: /\b(senior|sr\.?|lead|expert)\b/i },
];

export const inferSeniority = (title: string, declared?: string): string => {
    const stated = declared?.trim().toLowerCase();
    if (stated && stated.length > 0 && stated !== "any") {
        const known = SENIORITY_PATTERNS.find((entry) => entry.pattern.test(stated));
        if (known) return known.seniority;
    }
    const matched = SENIORITY_PATTERNS.find((entry) => entry.pattern.test(title));
    return matched?.seniority ?? "mid";
};

const HTML_ENTITIES: Readonly<Record<string, string>> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
    "&apos;": "'", "&nbsp;": " ", "&rsquo;": "'", "&ldquo;": '"', "&rdquo;": '"',
};

export const htmlToText = (html: string): string =>
    html
        .replace(/<\s*(br|\/p|\/li|\/div|\/h[1-6])\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&#?\w+;/g, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .trim();

/** Pulls a yearly figure out of free-text salary strings such as "OTE $25k - $35k" or "$120,000/yr". */
export const parseYearlySalary = (raw?: string): number | undefined => {
    if (!raw) return undefined;
    const matches = [...raw.matchAll(/(\d[\d,.]*)\s*(k\b)?/gi)]
        .map((match) => {
            const digits = Number(match[1].replace(/[,.]/g, ""));
            if (!Number.isFinite(digits) || digits <= 0) return 0;
            return match[2] ? digits * 1000 : digits;
        })
        .filter((value) => value >= 1000 && value <= 1_000_000);
    if (matches.length === 0) return undefined;
    return Math.round(matches.reduce((sum, value) => sum + value, 0) / matches.length);
};

const MAX_REQUIREMENTS = 12;

export const requirementsFromTags = (tags: readonly unknown[] | undefined): string[] | undefined => {
    if (!Array.isArray(tags)) return undefined;
    const cleaned = tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= 100)
        .slice(0, MAX_REQUIREMENTS);
    return cleaned.length > 0 ? cleaned : undefined;
};

const MIN_DESCRIPTION = 40;
const MAX_DESCRIPTION = 20_000;
const MAX_FIELD = 200;

/** Drops postings the job schema would reject, so a bad record never fails a whole batch. */
export const isImportable = (job: NormalizedPublicJob): boolean =>
    job.jobTitle.length > 0
    && job.jobTitle.length <= MAX_FIELD
    && job.company.length > 0
    && job.company.length <= MAX_FIELD
    && job.description.length >= MIN_DESCRIPTION
    && job.description.length <= MAX_DESCRIPTION
    && looksEnglish(job.jobTitle, job.description);

/**
 * Markers that appear almost exclusively in German-language postings. The public boards mix
 * languages, and a non-English posting embeds poorly against English queries.
 */
const NON_ENGLISH_MARKERS: readonly RegExp[] = [
    /\(\s*m\s*\/\s*w\s*\/\s*d\s*\)/i,
    /\b(gmbh|mbh)\b/i,
    /\b(und|oder|für|mit|bei|einen|eine|wir suchen|deine|ihre)\b/i,
    /\b(steuerfach|buchhalt|vertrieb|mitarbeiter|ausbildung)/i,
];

export const looksEnglish = (title: string, description: string): boolean => {
    const sample = `${title}\n${description.slice(0, 600)}`;
    const hits = NON_ENGLISH_MARKERS.filter((pattern) => pattern.test(sample)).length;
    return hits < 2;
};

export const jobKey = (jobTitle: string, company: string): string =>
    `${jobTitle.trim().toLowerCase()}@${company.trim().toLowerCase()}`;

export const withSourceCredit = (description: string, source: PublicJobSource, url?: string): string => {
    const credit = url ? `Source: ${source} — ${url}` : `Source: ${source}`;
    return `${description}\n\n${credit}`.slice(0, MAX_DESCRIPTION);
};
