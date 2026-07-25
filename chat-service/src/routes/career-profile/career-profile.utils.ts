import type { ProfileInput } from "../conversation/conversation.types";
import { EXPLICIT_USER_SIGNAL_CONFIDENCE } from "./career-profile.consts";
import type { CareerProfileSignalUpdate, CareerSignal } from "./career-profile.types";

const MAX_PROFILE_EVIDENCE_CHARS = 1_000;

const normalizeValues = (values: readonly string[]): string[] => {
    const valuesByKey = new Map<string, string>();
    values.forEach((value) => {
        const trimmedValue = value.trim();
        if (trimmedValue.length > 0 && !valuesByKey.has(trimmedValue.toLowerCase())) {
            valuesByKey.set(trimmedValue.toLowerCase(), trimmedValue);
        }
    });
    return [...valuesByKey.values()];
};

const buildProfileEvidence = (profile: ProfileInput): string =>
    [
        profile.currentJob ?? "",
        ...(profile.achievements?.map((achievement) => achievement.name) ?? []),
        ...(profile.technologies ?? []),
        ...(profile.interests ?? []),
        ...(profile.githubSkills ?? []),
        ...(profile.knownSkills ?? []),
        profile.cvExcerpt ?? "",
    ]
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .join(" | ")
        .slice(0, MAX_PROFILE_EVIDENCE_CHARS);

const toExplicitSignals = (values: readonly string[], evidence: string, updatedAt: Date): CareerSignal[] =>
    normalizeValues(values).map((value) => ({
        value,
        confidence: EXPLICIT_USER_SIGNAL_CONFIDENCE,
        evidence: evidence.length > 0 ? [evidence] : [value],
        source: "cv",
        updatedAt,
    }));

export const hasUsableProfileInput = (profile?: ProfileInput): profile is ProfileInput => {
    if (!profile) {
        return false;
    }
    return Boolean(
        profile.currentJob?.trim()
        || profile.cvExcerpt?.trim()
        || (profile.achievements && profile.achievements.length > 0)
        || (profile.technologies && profile.technologies.length > 0)
        || (profile.interests && profile.interests.length > 0)
        || (profile.githubSkills && profile.githubSkills.length > 0)
        || (profile.knownSkills && profile.knownSkills.length > 0)
    );
};

export const toCareerProfileSignalUpdateFromProfileInput = (profile: ProfileInput): CareerProfileSignalUpdate => {
    const updatedAt = new Date();
    const evidence = buildProfileEvidence(profile);
    const technologies = [
        ...(profile.technologies ?? []),
        ...(profile.githubSkills ?? []),
        ...(profile.knownSkills ?? []),
    ];
    const interests = profile.interests ?? [];
    const extractedKeywords = [
        profile.currentJob ?? "",
        ...(profile.achievements?.map((achievement) => achievement.name) ?? []),
        ...technologies,
        ...interests,
    ];

    return {
        technologies: toExplicitSignals(technologies, evidence, updatedAt),
        interests: toExplicitSignals(interests, evidence, updatedAt),
        extractedKeywords: toExplicitSignals(extractedKeywords, evidence, updatedAt),
    };
};
