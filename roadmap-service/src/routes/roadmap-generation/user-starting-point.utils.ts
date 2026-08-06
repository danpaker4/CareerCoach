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
const SKILL_PREVIEW_COUNT = 8;

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

const isCvStoragePath = (value: string): boolean =>
    /^s3:\/\//i.test(value) || /^uploads\/cv\//i.test(value);

const formatSkillsPreview = (userSkills: readonly string[]): string => {
    const preview = userSkills.slice(0, SKILL_PREVIEW_COUNT).join(", ");
    const suffix = userSkills.length > SKILL_PREVIEW_COUNT ? ", …" : "";
    return `${preview}${suffix}`;
};

const appendSkillsToSummary = (base: string, userSkills: readonly string[]): string => {
    if (userSkills.length === 0) return base;
    return `${base} — skills include ${formatSkillsPreview(userSkills)}`;
};

const readAchievementSkills = (profile: Record<string, unknown> | null): string[] => {
    if (!Array.isArray(profile?.achievements)) return [];
    return profile.achievements
        .filter((item): item is { name: string } =>
            typeof item === "object" && item !== null && "name" in item && typeof (item as { name: unknown }).name === "string"
        )
        .map((item) => item.name.trim())
        .filter((name) => name.length > 0);
};

/** True when we have extractable CV text (not just an S3 upload path). */
export const hasReadableCvText = (profile: Record<string, unknown> | null): boolean => {
    const cvText = readString(profile?.cvText);
    if (cvText !== null && cvText.length > 50) return true;
    const cv = readString(profile?.cv);
    return cv !== null && cv.length > 50 && !isCvStoragePath(cv);
};

/** True when a CV was uploaded (S3/path) or readable CV text exists. */
export const hasUploadedCv = (profile: Record<string, unknown> | null): boolean => {
    if (hasReadableCvText(profile)) return true;
    const cv = readString(profile?.cv);
    return cv !== null && isCvStoragePath(cv);
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
    if (hasUploadedCv(profile)) return true;
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
    const source = hasGithubUrl ? "GitHub and profile" : "profile";
    return `Early-career builder with demonstrated skills from ${source} (${formatSkillsPreview(userSkills)}) — no professional work experience or CV yet.`;
};

const formatCvBackedSummary = (userSkills: readonly string[], hasReadableCv: boolean): string => {
    if (userSkills.length > 0) {
        const cvNote = hasReadableCv ? "CV and profile" : "CV on file and profile";
        return `Professional with ${cvNote} evidence — skills include ${formatSkillsPreview(userSkills)}`;
    }
    if (hasReadableCv) {
        return "Professional with detailed CV text on file (no structured skills list extracted yet)";
    }
    return "Professional with CV on file (no structured skills list extracted yet)";
};

export const resolveUserStartingPoint = (
    profile: Record<string, unknown> | null,
    careerProfile: CareerProfileSummary | null
): UserStartingPoint => {
    const userSkills = extractUserSkills(profile, careerProfile, true);
    const hasWorkExperience = hasProfessionalExperience(profile);
    const isEntryLevel = !hasWorkExperience;
    const hasGithubUrl = readString(profile?.githubUrl) !== null;
    const readableCv = hasReadableCvText(profile);

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
    const displayLabel = readString(primaryExperience?.displayLabel);

    const currentRoleSummary =
        currentJob !== "Not specified"
            ? appendSkillsToSummary(
                  years > 0 && displayLabel
                      ? `${currentJob} (${years} years in ${displayLabel})`
                      : currentJob,
                  userSkills
              )
            : hasUploadedCv(profile)
              ? formatCvBackedSummary(userSkills, readableCv)
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
