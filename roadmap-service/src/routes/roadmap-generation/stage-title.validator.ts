const COMPANY_IN_TITLE_PATTERN = /\bat\s+[\w\s&.]+$/i;
const KNOWN_COMPANIES = ["google", "meta", "amazon", "microsoft", "apple", "netflix", "wix", "monday", "nvidia"];

export const isInvalidStageTitle = (title: string): boolean => {
    const trimmed = title.trim();
    if (trimmed.length === 0) return true;
    if (COMPANY_IN_TITLE_PATTERN.test(trimmed)) return true;
    const lower = trimmed.toLowerCase();
    return KNOWN_COMPANIES.some((company) => lower.includes(` at ${company}`) || lower.endsWith(` ${company}`));
};

export const sanitizeStageTitle = (title: string): string =>
    title.replace(COMPANY_IN_TITLE_PATTERN, "").replace(/\s+/g, " ").trim();
