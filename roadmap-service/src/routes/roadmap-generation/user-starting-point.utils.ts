import type { CareerProfileSummary } from "../external/roadmap.external.service";

type RoleExperienceEntry = {
    roleKey?: string;
    displayLabel?: string;
    years?: number;
    level?: string;
    evidence?: string[];
    source?: string;
};

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

const hasCvContent = (profile: Record<string, unknown> | null): boolean => {
    const cv = readString(profile?.cv);
    return cv !== null && cv.length > 50;
};

const hasProfileSkills = (profile: Record<string, unknown> | null): boolean => {
    const skillKeys = ["technologies", "knownSkills", "githubSkills"] as const;
    return skillKeys.some((key) => readStringArray(profile?.[key]).length > 0);
};

const hasDocumentedRoleExperience = (profile: Record<string, unknown> | null): boolean => {
    if (!Array.isArray(profile?.roleExperience)) return false;
    return (profile.roleExperience as RoleExperienceEntry[]).some(
        (entry) =>
            (typeof entry.years === "number" && entry.years > 0) ||
            (Array.isArray(entry.evidence) && entry.evidence.length > 0)
    );
};

export const hasSubstantialCareerBackground = (
    profile: Record<string, unknown> | null,
    careerProfile: CareerProfileSummary | null
): boolean => {
    if (hasCvContent(profile)) return true;
    if (readString(profile?.currentJob) !== null) return true;
    if (hasProfileSkills(profile)) return true;
    if (hasDocumentedRoleExperience(profile)) return true;
    if ((careerProfile?.technologies.length ?? 0) > 0) return true;
    return false;
};

const extractUserSkills = (
    profile: Record<string, unknown> | null,
    careerProfile: CareerProfileSummary | null,
    includeCoachSkills: boolean
): string[] => {
    const skillKeys = ["technologies", "knownSkills", "githubSkills", "interests"];
    const merged = skillKeys.flatMap((key) => readStringArray(profile?.[key]));
    if (includeCoachSkills && careerProfile?.technologies.length) {
        merged.push(...careerProfile.technologies);
    }
    return [...new Set(merged)];
};

const ENTRY_LEVEL_SUMMARY =
    "Recently finished high school — no professional experience, skills, or CV provided yet.";

export const resolveUserStartingPoint = (
    profile: Record<string, unknown> | null,
    careerProfile: CareerProfileSummary | null
): UserStartingPoint => {
    const isEntryLevel = !hasSubstantialCareerBackground(profile, careerProfile);

    if (isEntryLevel) {
        return {
            isEntryLevel: true,
            currentJob: "Not yet employed",
            currentRoleSummary: ENTRY_LEVEL_SUMMARY,
            userSkills: [],
            demonstratedResponsibilities: [],
            roleExperienceYears: 0,
            roleExperienceLevel: "entry",
            preferredDomains: [],
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
            : hasProfileSkills(profile)
                ? "Early-career professional building foundational skills"
                : ENTRY_LEVEL_SUMMARY;

    return {
        isEntryLevel: false,
        currentJob,
        currentRoleSummary,
        userSkills: extractUserSkills(profile, careerProfile, true),
        demonstratedResponsibilities: roleExperience.flatMap((entry) => entry.evidence ?? []),
        roleExperienceYears: years,
        roleExperienceLevel: explicitLevel ?? "entry",
        preferredDomains: careerProfile?.preferredDomains ?? [],
        longTermGoals: careerProfile?.longTermGoals ?? [],
    };
};

export const formatStartingPointForPrompt = (startingPoint: UserStartingPoint): string => {
    if (startingPoint.isEntryLevel) {
        return [
            "STARTING POINT: User recently finished high school.",
            "No CV, skills list, or work experience was provided.",
            "Do NOT assume any seniority level, domain expertise, or current job title.",
            "Treat the user as a complete beginner entering the workforce.",
            "Early roadmap stages must focus on foundational learning before job applications.",
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
