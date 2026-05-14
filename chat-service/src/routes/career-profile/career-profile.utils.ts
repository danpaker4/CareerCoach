import type { CareerProfileSignalBucketKey, CareerProfileSignalUpdate, CareerSignal, UserCareerProfile } from "./career-profile.types";
import { CAREER_PROFILE_SIGNAL_BUCKETS, SIGNAL_CONFIDENCE_WEAK_OVERRIDE_GAP } from "./career-profile.consts";

const normalizeSignalValue = (value: string): string => value.trim().toLowerCase();

const uniqueEvidence = (evidence: readonly string[]): string[] =>
    [...new Set(evidence.map((item) => item.trim()).filter((item) => item.length > 0))];

const clampConfidence = (confidence: number): number =>
    Math.max(0, Math.min(1, confidence));

const mergeSignalsForBucket = (existingSignals: readonly CareerSignal[], incomingSignals: readonly CareerSignal[]): CareerSignal[] => {
    const mergedByValue = new Map<string, CareerSignal>();
    for (const signal of existingSignals) {
        mergedByValue.set(normalizeSignalValue(signal.value), {
            ...signal,
            confidence: clampConfidence(signal.confidence),
            evidence: uniqueEvidence(signal.evidence),
        });
    }

    for (const signal of incomingSignals) {
        const key = normalizeSignalValue(signal.value);
        const existing = mergedByValue.get(key);
        const normalizedIncoming: CareerSignal = {
            ...signal,
            value: signal.value.trim(),
            confidence: clampConfidence(signal.confidence),
            evidence: uniqueEvidence(signal.evidence),
        };

        if (!existing) {
            mergedByValue.set(key, normalizedIncoming);
            continue;
        }

        const incomingClearlyStronger = normalizedIncoming.confidence >= existing.confidence + SIGNAL_CONFIDENCE_WEAK_OVERRIDE_GAP;
        const preferredValue = incomingClearlyStronger ? normalizedIncoming.value : existing.value;
        const preferredSource = incomingClearlyStronger ? normalizedIncoming.source : existing.source;
        const preferredConfidence = incomingClearlyStronger
            ? normalizedIncoming.confidence
            : Math.max(existing.confidence, normalizedIncoming.confidence * 0.95);
        const latestUpdate = normalizedIncoming.updatedAt > existing.updatedAt ? normalizedIncoming.updatedAt : existing.updatedAt;

        mergedByValue.set(key, {
            value: preferredValue,
            source: preferredSource,
            confidence: preferredConfidence,
            evidence: uniqueEvidence([...existing.evidence, ...normalizedIncoming.evidence]),
            updatedAt: latestUpdate,
        });
    }

    return [...mergedByValue.values()];
};

export const createEmptyProfileSignals = (): Record<CareerProfileSignalBucketKey, CareerSignal[]> => ({
    strengths: [],
    weakSignals: [],
    preferredRoles: [],
    dislikedRoles: [],
    preferredDomains: [],
    dislikedDomains: [],
    technologies: [],
    softSkills: [],
    motivations: [],
    interests: [],
    dislikes: [],
    workStyle: [],
    personalitySignals: [],
    longTermGoals: [],
    shortTermGoals: [],
    extractedKeywords: [],
});

export const mergeProfileSignals = (existingProfile: UserCareerProfile, updates: CareerProfileSignalUpdate): UserCareerProfile => {
    const mergedSignals = createEmptyProfileSignals();
    for (const bucket of CAREER_PROFILE_SIGNAL_BUCKETS) {
        mergedSignals[bucket] = mergeSignalsForBucket(existingProfile[bucket], updates[bucket] ?? []);
    }

    return {
        ...existingProfile,
        ...mergedSignals,
        salaryExpectation: updates.salaryExpectation ?? existingProfile.salaryExpectation,
        locationPreference: updates.locationPreference ?? existingProfile.locationPreference,
        remotePreference: updates.remotePreference ?? existingProfile.remotePreference,
        senioritySignal: updates.senioritySignal ?? existingProfile.senioritySignal,
        uncertaintyLevel: typeof updates.uncertaintyLevel === "number" ? Math.max(0, Math.min(1, updates.uncertaintyLevel)) : existingProfile.uncertaintyLevel,
        updatedAt: new Date(),
    };
};

export const toProfileSummaryText = (profile: UserCareerProfile): string => {
    const bucketSection = (bucket: CareerProfileSignalBucketKey, title: string): string => {
        const values = profile[bucket].map((item) => item.value).slice(0, 8);
        return `${title}: ${values.length > 0 ? values.join(", ") : "none"}`;
    };

    return [
        `User ${profile.userId}`,
        bucketSection("preferredRoles", "Preferred roles"),
        bucketSection("technologies", "Technologies"),
        bucketSection("interests", "Interests"),
        bucketSection("workStyle", "Work style"),
        bucketSection("shortTermGoals", "Short-term goals"),
        bucketSection("longTermGoals", "Long-term goals"),
        `Seniority: ${profile.senioritySignal ?? "unknown"}`,
        `Location preference: ${profile.locationPreference ?? "unknown"}`,
        `Remote preference: ${profile.remotePreference ?? "unknown"}`,
    ].join("\n");
};
