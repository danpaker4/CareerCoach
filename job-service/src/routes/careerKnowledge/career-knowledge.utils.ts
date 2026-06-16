const COMPANY_SUFFIX_PATTERN = /\s+at\s+[\w\s&.]+$/i;
const PARENTHESIS_PATTERN = /\s*\([^)]*\)\s*/g;

const SENIORITY_PREFIXES = [
    "principal",
    "staff",
    "lead",
    "senior",
    "sr.",
    "sr",
    "mid",
    "junior",
    "jr.",
    "jr",
    "entry",
    "intern",
] as const;

export const SENIORITY_RANK: Record<string, number> = {
    intern: 0,
    entry: 1,
    junior: 2,
    jr: 2,
    "jr.": 2,
    mid: 3,
    senior: 4,
    sr: 4,
    "sr.": 4,
    lead: 5,
    staff: 6,
    principal: 7,
    architect: 8,
};

export const normalizeRoleTitle = (rawTitle: string): string =>
    rawTitle
        .replace(COMPANY_SUFFIX_PATTERN, "")
        .replace(PARENTHESIS_PATTERN, " ")
        .replace(/\s+/g, " ")
        .trim();

export const extractSeniorityToken = (title: string, seniorityField: string): string => {
    const combined = `${title} ${seniorityField}`.toLowerCase();
    const matched = SENIORITY_PREFIXES.find((prefix) => combined.includes(prefix));
    if (matched) {
        return matched.replace(".", "");
    }
    return seniorityField.trim().toLowerCase() || "mid";
};

export const normalizeRoleCategory = (rawTitle: string, seniorityField: string): string => {
    const title = normalizeRoleTitle(rawTitle).toLowerCase();
    const seniority = extractSeniorityToken(title, seniorityField);

    const withoutSeniority = SENIORITY_PREFIXES.reduce(
        (acc, prefix) => acc.replace(new RegExp(`\\b${prefix}\\.?\\b`, "gi"), ""),
        title
    )
        .replace(/\s+/g, " ")
        .trim();

    const baseRole = withoutSeniority.length > 0 ? withoutSeniority : title;
    const capitalizedBase = baseRole
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    const seniorityLabel = seniority.charAt(0).toUpperCase() + seniority.slice(1);
    return `${seniorityLabel} ${capitalizedBase}`.trim();
};

export const inferRoleFamily = (roleCategory: string): string => {
    const lower = roleCategory.toLowerCase();
    if (lower.includes("frontend") || lower.includes("front-end") || lower.includes("ui")) return "frontend";
    if (lower.includes("backend") || lower.includes("back-end") || lower.includes("api")) return "backend";
    if (lower.includes("full stack") || lower.includes("fullstack")) return "fullstack";
    if (lower.includes("devops") || lower.includes("platform") || lower.includes("sre")) return "devops";
    if (lower.includes("data")) return "data";
    if (lower.includes("mobile")) return "mobile";
    if (lower.includes("architect")) return "architecture";
    if (lower.includes("manager") || lower.includes("lead")) return "leadership";
    return "engineering";
};

export const seniorityRank = (seniorityToken: string): number =>
    SENIORITY_RANK[seniorityToken.toLowerCase().replace(".", "")] ?? 3;

export const mergeStringLists = (lists: readonly (readonly string[])[]): string[] => {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const list of lists) {
        for (const item of list) {
            const key = item.trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            merged.push(item.trim());
        }
    }
    return merged;
};

export const toCounterObject = (values: readonly string[]): Record<string, number> =>
    values.reduce<Record<string, number>>((acc, item) => {
        const key = item.trim();
        if (!key) return acc;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});
