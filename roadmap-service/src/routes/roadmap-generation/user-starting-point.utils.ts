import type { CareerProfileSummary } from "../external/roadmap.external.service";

type RoleExperienceEntry = {
    roleKey?: string;
    displayLabel?: string;
    years?: number;
    level?: string;
    evidence?: string[];
    source?: string;
};

const GITHUB_PROJECT_COUNT_SKILL_SUFFIX = " github projects";

export type UserStartingPoint = {
    isEntryLevel: boolean;
    currentJob: string;
    currentRoleSummary: string;
    userSkills: string[];
    demonstratedResponsibilities: string[];
    roleExperienceYears: number;
    roleExperienceLevel: string;
    preferredDomains: string[];
    longTermGoals: string[];
};

const readString = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string").map((s) => s.trim()).filter(Boolean)
        : [];

const isGithubProjectCountSkill = (skill: string): boolean =>
    skill.toLowerCase().endsWith(GITHUB_PROJECT_COUNT_SKILL_SUFFIX);

const readAchievementSkills = (profile: Record<string, unknown> | null): string[] => {
    if (!Array.isArray(profile?.achievements)) return [];
    return profile.achievements
        .filter((item): item is { name: string } =>
            typeof item === "object" && item !== null && "name" in item && typeof (item as { name: unknown }).name === "string"
        )
        .map((item) => item.name.trim())
        .filter((name) => name.length > 0);
};

const hasCvContent = (profile: Record<string, unknown> | null): boolean => {
    const cv = readString(profile?.cv);
    return cv !== null && cv.length > 50;
};

const hasDocumentedRoleExperience = (profile: Record<string, unknown> | null): boolean => {
    if (!Array.isArray(profile?.roleExperience)) return false;
    return (profile.roleExperience as RoleExperienceEntry[]).some(
        (entry) =>
            (typeof entry.years === "number" && entry.years > 0) ||
            (Array.isArray(entry.evidence) && entry.evidence.length > 0)
    );
};

export const extractUserSkills = (
    profile: Record<string, unknown> | null,
    careerProfile: CareerProfileSummary | null,
    includeCoachSkills: boolean
): string[] => {
    const skillKeys = ["technologies", "knownSkills", "githubSkills", "interests"] as const;
    const merged = [
        ...skillKeys.flatMap((key) => readStringArray(profile?.[key])),
        ...readAchievementSkills(profile),
    ];
    if (includeCoachSkills && careerProfile?.technologies.length) {
        merged.push(...careerProfile.technologies);
    }
    return [...new Set(merged.filter((skill) => !isGithubProjectCountSkill(skill)))];
};

export const hasProfessionalExperience = (profile: Record<string, unknown> | null): boolean => {
    if (hasCvContent(profile)) return true;
    if (readString(profile?.currentJob) !== null) return true;
    if (hasDocumentedRoleExperience(profile)) return true;
    return false;
};

export const hasDemonstratedSkills = (
    profile: Record<string, unknown> | null,
    careerProfile: CareerProfileSummary | null
): boolean => extractUserSkills(profile, careerProfile, true).length > 0;

export const hasSubstantialCareerBackground = (
    profile: Record<string, unknown> | null,
    careerProfile: CareerProfileSummary | null
): boolean => hasProfessionalExperience(profile) || hasDemonstratedSkills(profile, careerProfile);

const ENTRY_LEVEL_NO_SIGNALS_SUMMARY =
    "Recently finished high school — no professional experience, skills, or CV provided yet.";

const formatSkillsOnlySummary = (userSkills: string[], hasGithubUrl: boolean): string => {
    const preview = userSkills.slice(0, 6).join(", ");
    const suffix = userSkills.length > 6 ? ", …" : "";
    const source = hasGithubUrl ? "GitHub and profile" : "profile";
    return `Early-career builder with demonstrated skills from ${source} (${preview}${suffix}) — no professional work experience or CV yet.`;
};

export const resolveUserStartingPoint = (
    profile: Record<string, unknown> | null,
    careerProfile: CareerProfileSummary | null
): UserStartingPoint => {
    const userSkills = extractUserSkills(profile, careerProfile, true);
    const hasWorkExperience = hasProfessionalExperience(profile);
    const isEntryLevel = !hasWorkExperience;
    const hasGithubUrl = readString(profile?.githubUrl) !== null;

    if (!hasWorkExperience && userSkills.length === 0) {
        return {
            isEntryLevel: true,
            currentJob: "Not yet employed",
            currentRoleSummary: ENTRY_LEVEL_NO_SIGNALS_SUMMARY,
            userSkills: [],
            demonstratedResponsibilities: [],
            roleExperienceYears: 0,
            roleExperienceLevel: "entry",
            preferredDomains: [],
            longTermGoals: careerProfile?.longTermGoals ?? [],
        };
    }

    if (!hasWorkExperience) {
        return {
            isEntryLevel: true,
            currentJob: "Not yet employed",
            currentRoleSummary: formatSkillsOnlySummary(userSkills, hasGithubUrl),
            userSkills,
            demonstratedResponsibilities: [],
            roleExperienceYears: 0,
            roleExperienceLevel: "entry",
            preferredDomains: careerProfile?.preferredDomains ?? [],
            longTermGoals: careerProfile?.longTermGoals ?? [],
        };
    }

    const roleExperience = Array.isArray(profile?.roleExperience)
        ? (profile.roleExperience as RoleExperienceEntry[])
        : [];
    const primaryExperience = roleExperience[0];
    const currentJob = readString(profile?.currentJob) ?? "Not specified";
    const explicitLevel = readString(primaryExperience?.level);
    const years = typeof primaryExperience?.years === "number" ? primaryExperience.years : 0;

    const currentRoleSummary = currentJob !== "Not specified"
        ? years > 0 && primaryExperience?.displayLabel
            ? `${currentJob} (${years} years in ${primaryExperience.displayLabel})`
            : currentJob
        : hasCvContent(profile)
            ? "Early-career professional with CV on file"
            : formatSkillsOnlySummary(userSkills, hasGithubUrl);

    return {
        isEntryLevel: false,
        currentJob,
        currentRoleSummary,
        userSkills,
        demonstratedResponsibilities: roleExperience.flatMap((entry) => entry.evidence ?? []),
        roleExperienceYears: years,
        roleExperienceLevel: explicitLevel ?? "entry",
        preferredDomains: careerProfile?.preferredDomains ?? [],
        longTermGoals: careerProfile?.longTermGoals ?? [],
    };
};

export const formatStartingPointForPrompt = (startingPoint: UserStartingPoint): string => {
    if (startingPoint.isEntryLevel && startingPoint.userSkills.length === 0) {
        return [
            "STARTING POINT: User recently finished high school.",
            "No CV, skills list, or work experience was provided.",
            "Do NOT assume any seniority level, domain expertise, or current job title.",
            "Treat the user as a complete beginner entering the workforce.",
            "Early roadmap stages must focus on foundational learning before job applications.",
        ].join("\n");
    }

    if (startingPoint.isEntryLevel) {
        return [
            "STARTING POINT: User has no professional work experience or CV yet.",
            `Demonstrated skills (GitHub/profile — treat as real evidence): ${startingPoint.userSkills.join(", ")}`,
            "Do NOT invent seniority, past job titles, or years of industry experience.",
            "Build on existing demonstrated skills while closing leadership, business, and experience gaps for the dream role.",
            `Summary: ${startingPoint.currentRoleSummary}`,
        ].join("\n");
    }

    return [
        `Current role: ${startingPoint.currentJob}`,
        `Summary: ${startingPoint.currentRoleSummary}`,
        `Experience: ${startingPoint.roleExperienceYears} years at ${startingPoint.roleExperienceLevel} level`,
        `Skills on file: ${startingPoint.userSkills.join(", ") || "none listed"}`,
        "Use ONLY the facts above for currentRoleSummary — do not invent seniority or domains.",
    ].join("\n");
};
