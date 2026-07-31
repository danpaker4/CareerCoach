import { normalizeCapabilityTexts } from "../catalog/capability-normalization";
import {
    DEFAULT_CURRENT_LEVEL,
    LEVEL,
} from "../scoring/roadmap-scoring.consts";
import type { UserCareerContext } from "../gap-analysis.types";
import type { UserCapability } from "./structured-gap.types";

export const buildUserCapabilities = (user: UserCareerContext): UserCapability[] => {
    const skillCaps = normalizeCapabilityTexts(user.userSkills);
    const responsibilityCaps = normalizeCapabilityTexts(user.demonstratedResponsibilities);
    const domainCaps = normalizeCapabilityTexts(user.preferredDomains);
    const byId = new Map<string, UserCapability>();

    const upsert = (
        capabilityId: string,
        label: string,
        category: UserCapability["category"],
        evidenceDetail: string,
        source: UserCapability["evidence"][number]["source"],
        level: number
    ): void => {
        const existing = byId.get(capabilityId);
        if (existing) {
            byId.set(capabilityId, {
                ...existing,
                currentLevel: Math.min(LEVEL.expert, Math.max(existing.currentLevel, level)),
                confidence: Math.min(1, existing.confidence + 0.1),
                evidence: [...existing.evidence, { source, detail: evidenceDetail }],
            });
            return;
        }
        byId.set(capabilityId, {
            capabilityId,
            label,
            category,
            currentLevel: Math.min(LEVEL.expert, Math.max(DEFAULT_CURRENT_LEVEL, level)),
            confidence: source === "inferred" ? 0.4 : 0.75,
            evidence: [{ source, detail: evidenceDetail }],
        });
    };

    for (const cap of skillCaps) {
        upsert(cap.id, cap.label, cap.category, cap.sourceText, "profile", LEVEL.working);
    }
    for (const cap of responsibilityCaps) {
        upsert(
            cap.id,
            cap.label,
            cap.category === "technical" ? "responsibility" : cap.category,
            cap.sourceText,
            "profile",
            LEVEL.working
        );
    }
    for (const cap of domainCaps) {
        upsert(cap.id, cap.label, "domain", cap.sourceText, "careerProfile", LEVEL.awareness);
    }

    if (!user.isEntryLevel || user.roleExperienceYears >= 1) {
        upsert(
            "cap.professional.experience",
            "Professional experience",
            "experience",
            `${user.roleExperienceYears} years as ${user.roleExperienceLevel}`,
            "profile",
            Math.min(LEVEL.expert, LEVEL.awareness + Math.floor(user.roleExperienceYears / 2))
        );
    }

    if (user.userSkills.length > 0) {
        upsert("cap.portfolio", "Portfolio and evidence", "experience", "Skills present on profile", "profile", LEVEL.awareness);
    }

    return [...byId.values()];
};
