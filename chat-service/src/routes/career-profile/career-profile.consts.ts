import type { CareerProfileSignalBucketKey } from "./career-profile.types";

export const CAREER_PROFILE_SIGNAL_BUCKETS: readonly CareerProfileSignalBucketKey[] = [
    "strengths",
    "weakSignals",
    "preferredRoles",
    "dislikedRoles",
    "preferredDomains",
    "dislikedDomains",
    "technologies",
    "softSkills",
    "motivations",
    "interests",
    "dislikes",
    "workStyle",
    "personalitySignals",
    "longTermGoals",
    "shortTermGoals",
    "extractedKeywords",
];

export const EXPLICIT_USER_SIGNAL_CONFIDENCE = 0.92;
export const SIGNAL_CONFIDENCE_WEAK_OVERRIDE_GAP = 0.18;
