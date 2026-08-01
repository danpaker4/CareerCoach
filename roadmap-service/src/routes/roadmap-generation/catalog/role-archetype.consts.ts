import type { RoleArchetypeCapability, RoleArchetypeId } from "./role-archetype.types";

const normalizeDreamJob = (dreamJob: string): string => dreamJob.trim().toLowerCase();

export const resolveRoleArchetype = (dreamJob: string): RoleArchetypeId => {
    const text = normalizeDreamJob(dreamJob);
    const isExecutive = /\b(ceo|chief|founder|co-founder|executive|vp|vice president|ciso|cto|coo)\b/.test(text);
    const isCyber = /\b(cybersecurity|cyber|infosec|information security|security)\b/.test(text);
    if (isExecutive && isCyber) return "executive_cyber";
    if (/\b(architect|architecture|principal|staff engineer|staff)\b/.test(text)) {
        return "architecture_ic";
    }
    if (/\b(engineer|developer|software|frontend|backend|fullstack|full stack)\b/.test(text)) {
        return "engineering_ic";
    }
    return "generic";
};

/** Experience-first ladder for cybersecurity executive destinations. */
export const EXECUTIVE_CYBER_LADDER: readonly RoleArchetypeCapability[] = [
    {
        capabilityId: "cap.cybersecurity",
        label: "Cybersecurity fundamentals",
        category: "domain",
        requiredLevel: 3,
        transitionRelevance: 1.4,
        reasonCode: "archetype_executive_cyber",
    },
    {
        capabilityId: "cap.security.operations",
        label: "Security operations experience",
        category: "experience",
        requiredLevel: 3,
        transitionRelevance: 1.35,
        reasonCode: "archetype_executive_cyber",
    },
    {
        capabilityId: "cap.security.architecture",
        label: "Security architecture judgment",
        category: "architecture",
        requiredLevel: 3,
        transitionRelevance: 1.3,
        reasonCode: "archetype_executive_cyber",
    },
    {
        capabilityId: "cap.professional.experience",
        label: "Hands-on cybersecurity roles",
        category: "experience",
        requiredLevel: 3,
        transitionRelevance: 1.4,
        reasonCode: "archetype_executive_cyber",
    },
    {
        capabilityId: "cap.leadership",
        label: "People and team leadership",
        category: "leadership",
        requiredLevel: 3,
        transitionRelevance: 1.35,
        reasonCode: "archetype_executive_cyber",
    },
    {
        capabilityId: "cap.project.ownership",
        label: "Business-critical ownership",
        category: "responsibility",
        requiredLevel: 3,
        transitionRelevance: 1.25,
        reasonCode: "archetype_executive_cyber",
    },
    {
        capabilityId: "cap.business.finance",
        label: "Business and P&L fluency",
        category: "domain",
        requiredLevel: 3,
        transitionRelevance: 1.3,
        reasonCode: "archetype_executive_cyber",
    },
    {
        capabilityId: "cap.executive.leadership",
        label: "Executive leadership readiness",
        category: "leadership",
        requiredLevel: 3,
        transitionRelevance: 1.45,
        reasonCode: "archetype_executive_cyber",
    },
] as const;

export const isCredentialLikeText = (text: string): boolean => {
    const normalized = text.trim().toLowerCase();
    return (
        /\b(bachelor|master|phd|doctorate|degree|diploma|bs\b|ba\b|ms\b|mba)\b/.test(normalized) ||
        /\beducation\b/.test(normalized)
    );
};

export const isNonActionableMarketFluff = (text: string): boolean => {
    const normalized = text.trim().toLowerCase();
    if (isCredentialLikeText(normalized)) return false;
    return (
        normalized.length > 120 ||
        /\b(years? of experience|must have|preferred qualifications|equal opportunity)\b/.test(normalized)
    );
};
