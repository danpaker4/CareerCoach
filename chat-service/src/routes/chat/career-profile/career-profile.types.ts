export type CareerSignalSource = "cv" | "chat" | "job_interaction" | "llm_inference";

export type CareerSignal = {
    value: string;
    confidence: number;
    evidence: string[];
    source: CareerSignalSource;
    updatedAt: Date;
};

export type CareerProfileSignalBucketKey =
    | "strengths"
    | "weakSignals"
    | "preferredRoles"
    | "dislikedRoles"
    | "preferredDomains"
    | "dislikedDomains"
    | "technologies"
    | "softSkills"
    | "motivations"
    | "interests"
    | "dislikes"
    | "workStyle"
    | "personalitySignals"
    | "longTermGoals"
    | "shortTermGoals"
    | "extractedKeywords";

export type CareerProfileSignals = Record<CareerProfileSignalBucketKey, CareerSignal[]>;

export type UserCareerProfile = CareerProfileSignals & {
    userId: string;
    salaryExpectation: string | null;
    locationPreference: string | null;
    remotePreference: string | null;
    senioritySignal: string | null;
    uncertaintyLevel: number;
    profileSummaryText: string;
    profileSummaryEmbedding: number[];
    updatedAt: Date;
    createdAt: Date;
};

/** API-safe view: same shape as `UserCareerProfile` but without large embedding vectors. */
export type PublicCareerProfileView = Omit<UserCareerProfile, "profileSummaryEmbedding"> & {
    profileSummaryEmbeddingLength: number;
};

/** Notifies users-service when chat first persists a career profile for `userId` (same as users `id`). */
export type CoachProfileAccountLink = {
    notifyProfileMaterialized: (userId: string) => Promise<void>;
};

export type CareerProfileSignalUpdate = Partial<CareerProfileSignals> & {
    salaryExpectation?: string | null;
    locationPreference?: string | null;
    remotePreference?: string | null;
    senioritySignal?: string | null;
    uncertaintyLevel?: number;
};
