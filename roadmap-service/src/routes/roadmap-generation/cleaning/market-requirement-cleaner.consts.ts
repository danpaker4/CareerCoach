export const JOB_AD_FLUFF_PATTERNS: readonly RegExp[] = [
    /\bwe (offer|are looking|provide|believe|want)\b/i,
    /\bjoin our\b/i,
    /\bsupportive (team|environment)\b/i,
    /\bhands-on experience with\b/i,
    /\bstart your (professional )?journey\b/i,
    /\bthis role (requires|is)\b/i,
    /\bequal opportunity\b/i,
    /\bcompetitive (salary|compensation|benefits)\b/i,
    /\bwork[- ]life balance\b/i,
    /\bremote[- ]friendly\b/i,
    /\bperformance systems?\b/i,
];

export const PERSONAL_TRAIT_PATTERNS: readonly RegExp[] = [
    /\beagerness to learn\b/i,
    /\bself[- ]motivated\b/i,
    /\bpassionate about\b/i,
    /\bteam player\b/i,
    /\bexcellent communication skills\b/i,
    /\bstrong work ethic\b/i,
    /\benthu(siastic|siasm)\b/i,
    /\bgo[- ]getter\b/i,
    /\bdetail[- ]oriented\b/i,
];

export const YEARS_EXPERIENCE_PATTERN = /\b\d+\+?\s*(years?|yrs?)\b/i;

export const COMPANY_SUFFIX_PATTERN = /\b(inc|llc|ltd|corp|corporation|gmbh|plc)\.?$/i;

export const CERTIFICATION_ALIASES: ReadonlyMap<string, string> = new Map([
    ["cissp", "CISSP"],
    ["cism", "CISM"],
    ["cisa", "CISA"],
    ["compTia security+".toLowerCase(), "CompTIA Security+"],
    ["security+", "CompTIA Security+"],
    ["oscp", "OSCP"],
    ["aws certified", "AWS certification"],
]);

export const MAX_PRIMARY_CAPABILITIES_PER_STAGE = 6;
export const MIN_PRIMARY_CAPABILITIES_PER_STAGE = 2;
