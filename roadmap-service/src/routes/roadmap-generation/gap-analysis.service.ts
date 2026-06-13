import type { GapAnalysisInput, GapAnalysisSnapshot } from "./gap-analysis.types";

const normalize = (value: string): string => value.trim().toLowerCase();

const hasSkill = (userSkills: readonly string[], required: string): boolean =>
    userSkills.some((skill) => {
        const s = normalize(skill);
        const r = normalize(required);
        return s === r || s.includes(r) || r.includes(s);
    });

const findMissing = (userSkills: readonly string[], required: readonly string[]): string[] => {
    const seen = new Set<string>();
    return required.filter((item) => {
        const key = normalize(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return !hasSkill(userSkills, item);
    });
};

const findPresent = (userSkills: readonly string[], required: readonly string[]): string[] => {
    const seen = new Set<string>();
    return required.filter((item) => {
        const key = normalize(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return hasSkill(userSkills, item);
    });
};

const estimateExperienceGap = (
    userYears: number,
    userLevel: string,
    seniorityDistribution: Record<string, number>,
    isEntryLevel: boolean,
    userSkills: readonly string[]
): string => {
    if (isEntryLevel && userSkills.length > 0) {
        return `No professional work experience yet, but the user has demonstrated skills (${userSkills.slice(0, 8).join(", ")}${userSkills.length > 8 ? ", …" : ""}) from GitHub/profile. Close leadership, business, and responsibility gaps on top of this foundation.`;
    }
    if (isEntryLevel) {
        return "User recently finished high school with no professional experience. Expect foundational learning stages before experience-based roles.";
    }
    const entries = Object.entries(seniorityDistribution);
    if (entries.length === 0) {
        return userYears >= 5
            ? `User has ${userYears} years at ${userLevel} level; dream role may require deeper seniority.`
            : `User has ${userYears} years experience; additional hands-on progression is likely required.`;
    }
    const dominant = entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "senior";
    return `Market postings for this role commonly expect ${dominant} seniority. User currently at ${userLevel} with ~${userYears} years experience.`;
};

export const buildGapAnalysis = (input: GapAnalysisInput): GapAnalysisSnapshot => {
    const market = input.market;
    const requiredSkills = market?.commonSkills ?? [];
    const marketResponsibilities = market?.responsibilities ?? [];
    const leadershipSignals = market?.leadershipSignals ?? [];
    const architectureSignals = market?.architectureSignals ?? [];

    const skillsPresent = findPresent(input.user.userSkills, requiredSkills);
    const skillsMissing = findMissing(input.user.userSkills, requiredSkills);

    const responsibilitiesMissing = marketResponsibilities.filter((responsibility) =>
        !input.user.demonstratedResponsibilities.some((demo) =>
            normalize(demo).includes(normalize(responsibility).slice(0, 20)) ||
            normalize(responsibility).includes(normalize(demo).slice(0, 20))
        )
    ).slice(0, 15);

    const leadershipGaps = leadershipSignals.filter((signal) =>
        !input.user.demonstratedResponsibilities.some((demo) => normalize(demo).includes(normalize(signal).slice(0, 12)))
    ).slice(0, 10);

    const architectureGaps = architectureSignals.filter((signal) =>
        !input.user.userSkills.some((skill) => normalize(skill).includes(normalize(signal)) || normalize(signal).includes(normalize(skill)))
    ).slice(0, 10);

    const domainGaps = input.user.preferredDomains.length === 0
        ? [`Build domain familiarity aligned with ${input.dreamJob}`]
        : [];

    const experienceGapSummary = estimateExperienceGap(
        input.user.roleExperienceYears,
        input.user.roleExperienceLevel,
        market?.seniorityDistribution ?? {},
        input.user.isEntryLevel === true,
        input.user.userSkills
    );

    return {
        skillsPresent,
        skillsMissing,
        responsibilitiesMissing,
        leadershipGaps,
        architectureGaps,
        domainGaps,
        experienceGapSummary,
    };
};

export const formatGapAnalysisForPrompt = (gap: GapAnalysisSnapshot): string => {
    const sections = [
        `Skills already demonstrated: ${gap.skillsPresent.join(", ") || "None identified"}`,
        `Skills missing for dream role: ${gap.skillsMissing.join(", ") || "None identified"}`,
        `Responsibilities not yet demonstrated: ${gap.responsibilitiesMissing.join("; ") || "None identified"}`,
        `Leadership gaps: ${gap.leadershipGaps.join("; ") || "None identified"}`,
        `Architecture gaps: ${gap.architectureGaps.join("; ") || "None identified"}`,
        `Domain gaps: ${gap.domainGaps.join("; ") || "None identified"}`,
        `Experience gap: ${gap.experienceGapSummary}`,
    ];
    return sections.join("\n");
};
