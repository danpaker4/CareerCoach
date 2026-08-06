import { normalizeCapabilityText } from "../catalog/capability-normalization";
import {
    CERTIFICATION_ALIASES,
    COMPANY_SUFFIX_PATTERN,
    JOB_AD_FLUFF_PATTERNS,
    PERSONAL_TRAIT_PATTERNS,
    YEARS_EXPERIENCE_PATTERN,
} from "./market-requirement-cleaner.consts";
import type {
    CleanedRequirement,
    MarketCleaningResult,
    RejectedRequirement,
    RequirementClass,
} from "./market-requirement-cleaner.types";

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, " ");

const looksLikeCompanyName = (text: string): boolean => {
    const trimmed = normalizeWhitespace(text);
    if (COMPANY_SUFFIX_PATTERN.test(trimmed)) return true;
    if (/^[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4}$/.test(trimmed) && trimmed.split(" ").length <= 4) {
        return /\b(Systems|Solutions|Technologies|Labs|Group|Partners|Consulting)\b/.test(trimmed);
    }
    return false;
};

const looksLikeJobAdSentence = (text: string): boolean => {
    const trimmed = normalizeWhitespace(text);
    if (trimmed.length > 100) return true;
    if (/[.!?]$/.test(trimmed) && trimmed.split(" ").length > 10) return true;
    if (/^(you will|you'll|your work will|we expect|responsible for)\b/i.test(trimmed)) return true;
    return JOB_AD_FLUFF_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const isPersonalTrait = (text: string): boolean =>
    PERSONAL_TRAIT_PATTERNS.some((pattern) => pattern.test(text));

const isYearsAsSkill = (text: string): boolean =>
    YEARS_EXPERIENCE_PATTERN.test(text) &&
    !/\b(degree|bachelor|master|phd|certification|certified)\b/i.test(text);

const classifyFromSignals = (text: string, capabilityCategory: string): RequirementClass => {
    const lower = text.toLowerCase();
    if (/\b(bachelor|master|phd|degree|diploma|education)\b/.test(lower)) return "EDUCATION";
    for (const [alias] of CERTIFICATION_ALIASES.entries()) {
        if (lower.includes(alias)) return "CERTIFICATION";
    }
    if (/\b(cissp|cism|cisa|oscp|security\+|certified)\b/.test(lower)) return "CERTIFICATION";
    if (YEARS_EXPERIENCE_PATTERN.test(lower) || /\b(experience|tenure|internship)\b/.test(lower)) {
        if (capabilityCategory === "experience") return "EXPERIENCE";
    }
    if (/\b(p&l|revenue|budget|business|gtm|go-to-market|customer|sales|investor|board)\b/.test(lower)) {
        return "BUSINESS";
    }
    if (/\b(lead|leadership|manage|mentor|people|executive|hiring)\b/.test(lower)) return "LEADERSHIP";
    if (/\b(own|ownership|responsible for|deliver|operate)\b/.test(lower) || capabilityCategory === "responsibility") {
        return "RESPONSIBILITY";
    }
    if (/\b(architecture|architect|system design|threat model)\b/.test(lower) || capabilityCategory === "architecture") {
        return "ARCHITECTURE";
    }
    if (/\b(cyber|security|infosec|soc|incident|zero trust)\b/.test(lower) || capabilityCategory === "domain") {
        if (/\b(cyber|security|infosec)\b/.test(lower)) return "CYBERSECURITY_DOMAIN";
    }
    if (capabilityCategory === "credential") return "EDUCATION";
    if (capabilityCategory === "leadership") return "LEADERSHIP";
    if (capabilityCategory === "experience") return "EXPERIENCE";
    if (capabilityCategory === "domain") return "CYBERSECURITY_DOMAIN";
    if (capabilityCategory === "soft") return "FOUNDATION";
    return "TECHNICAL_SKILL";
};

const toShortCapabilityName = (text: string, classification: RequirementClass): string => {
    const normalized = normalizeCapabilityText(text);
    if (classification === "EDUCATION") return "Computer science degree or equivalent";
    if (classification === "CERTIFICATION") {
        const lower = text.toLowerCase();
        for (const [alias, label] of CERTIFICATION_ALIASES.entries()) {
            if (lower.includes(alias)) return label;
        }
        return normalized.label;
    }
    if (classification === "EXPERIENCE") return "Professional cybersecurity experience";
    // Prefer catalog labels over long source phrases.
    if (normalized.label.length <= 60) return normalized.label;
    return normalized.label.slice(0, 57).trim() + "…";
};

export const cleanMarketRequirementTexts = (texts: readonly string[]): MarketCleaningResult => {
    const kept: CleanedRequirement[] = [];
    const removed: RejectedRequirement[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    for (const raw of texts) {
        if (typeof raw !== "string") continue;
        const input = normalizeWhitespace(raw);
        if (input.length === 0) continue;

        if (looksLikeCompanyName(input)) {
            removed.push({ input, reason: "company-name" });
            continue;
        }
        if (isPersonalTrait(input)) {
            removed.push({ input, reason: "personal-trait" });
            continue;
        }
        if (isYearsAsSkill(input) && !/\b(degree|bachelor|certification)\b/i.test(input)) {
            // Years of experience is tracked as EXPERIENCE later, not as a skill capability from this phrase alone.
            if (/^\s*\d+\+?\s*(years?|yrs?)(\s+of)?(\s+experience)?\s*$/i.test(input)) {
                removed.push({ input, reason: "years-as-skill" });
                continue;
            }
        }
        if (looksLikeJobAdSentence(input)) {
            // Try to salvage an underlying catalog skill from long duty sentences.
            const salvage = normalizeCapabilityText(input);
            const isDutyFluff = JOB_AD_FLUFF_PATTERNS.some((pattern) => pattern.test(input));
            if (
                salvage.id.startsWith("cap.dynamic.") ||
                salvage.label.length > 60 ||
                isDutyFluff ||
                input.split(" ").length > 12
            ) {
                removed.push({ input, reason: "job-ad-text" });
                continue;
            }
            // Only keep salvage when it collapses to a short known catalog skill.
            if (!salvage.id.startsWith("cap.") || salvage.id.startsWith("cap.dynamic.")) {
                removed.push({ input, reason: "job-ad-text" });
                continue;
            }
        }

        const normalized = normalizeCapabilityText(input);
        const classification = classifyFromSignals(input, normalized.category);
        if (classification === "PERSONAL_TRAIT") {
            removed.push({ input, reason: "personal-trait" });
            continue;
        }

        const normalizedName = toShortCapabilityName(input, classification);
        const nameKey = normalizedName.toLowerCase();
        if (seenIds.has(normalized.id) || seenNames.has(nameKey)) {
            removed.push({ input, reason: "duplicate" });
            continue;
        }

        // Skip ultra-specific tooling noise when it looks like a one-off product name with no catalog match.
        if (
            normalized.id.startsWith("cap.dynamic.") &&
            /^[A-Z0-9][\w.+-]{1,20}$/.test(input) &&
            !/\b(python|java|react|aws|azure|gcp|linux|sql)\b/i.test(input)
        ) {
            removed.push({ input, reason: "too-specific" });
            continue;
        }

        seenIds.add(normalized.id);
        seenNames.add(nameKey);
        kept.push({
            sourceText: input,
            normalizedName,
            capabilityId: normalized.id,
            classification,
            keep: true,
        });
    }

    return { kept, removed };
};

export const mapRequirementClassToCapabilityCategory = (
    classification: RequirementClass
): "technical" | "soft" | "domain" | "leadership" | "architecture" | "responsibility" | "experience" | "credential" => {
    switch (classification) {
        case "EDUCATION":
            return "credential";
        case "CERTIFICATION":
            return "credential";
        case "EXPERIENCE":
            return "experience";
        case "LEADERSHIP":
            return "leadership";
        case "BUSINESS":
            return "domain";
        case "RESPONSIBILITY":
            return "responsibility";
        case "ARCHITECTURE":
            return "architecture";
        case "CYBERSECURITY_DOMAIN":
            return "domain";
        case "FOUNDATION":
            return "technical";
        case "TECHNICAL_SKILL":
            return "technical";
        case "PERSONAL_TRAIT":
            return "soft";
    }
};
