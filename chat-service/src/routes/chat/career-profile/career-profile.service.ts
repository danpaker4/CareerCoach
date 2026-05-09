import type { EmbeddingPort } from "../../../ai/ports/embedding.types";
import type { Conversation } from "../conversation/conversation.model";
import { createEmptyProfileSignals, mergeProfileSignals, toProfileSummaryText } from "./career-profile.utils";
import type { CareerProfileSignalUpdate, CareerSignal, UserCareerProfile } from "./career-profile.types";
import { CareerProfileRepository } from "./career-profile.repository";
import { EXPLICIT_USER_SIGNAL_CONFIDENCE } from "./career-profile.consts";
import type { ProfileInput } from "../conversation/conversation.types";

const buildDefaultProfile = (userId: string): UserCareerProfile => {
    const now = new Date();
    return {
        userId,
        ...createEmptyProfileSignals(),
        salaryExpectation: null,
        locationPreference: null,
        remotePreference: null,
        senioritySignal: null,
        uncertaintyLevel: 0.5,
        profileSummaryText: "",
        profileSummaryEmbedding: [],
        createdAt: now,
        updatedAt: now,
    };
};

const toSignal = (value: string, evidence: string, source: CareerSignal["source"], confidence = EXPLICIT_USER_SIGNAL_CONFIDENCE): CareerSignal => ({
    value: value.trim(),
    confidence,
    evidence: [evidence],
    source,
    updatedAt: new Date(),
});

const splitByCommonDelimiters = (value: string): string[] =>
    value
        .split(/[,\n/|]/g)
        .map((item) => item.trim())
        .filter((item) => item.length > 1);

const dedupeStrings = (items: readonly string[]): string[] =>
    [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];

const extractKnownTechnologies = (message: string): string[] => {
    const canonicalMap: Record<string, string> = {
        nodejs: "Node.js",
        "node.js": "Node.js",
        node: "Node.js",
        mongodb: "MongoDB",
        mongo: "MongoDB",
        typescript: "TypeScript",
        javascript: "JavaScript",
        react: "React",
        angular: "Angular",
        cypress: "Cypress",
        kafka: "Kafka",
        redis: "Redis",
        docker: "Docker",
        kubernetes: "Kubernetes",
        python: "Python",
        java: "Java",
    };

    const lowered = message.toLowerCase();
    const found = new Set<string>();
    for (const [term, canonical] of Object.entries(canonicalMap)) {
        if (lowered.includes(term)) {
            found.add(canonical);
        }
    }
    return [...found];
};

const inferProfileUpdateFromMessage = (message: string): CareerProfileSignalUpdate => {
    const lowered = message.toLowerCase();
    const technologies = extractKnownTechnologies(message).map((item) => toSignal(item, message, "chat"));
    const interests: CareerSignal[] = [];
    const dislikes: CareerSignal[] = [];
    const motivations: CareerSignal[] = [];
    const preferredRoles: CareerSignal[] = [];

    if (lowered.includes("i like") || lowered.includes("i enjoy") || lowered.includes("love")) {
        const afterLike = message.split(/i like|i enjoy|love/gi).slice(1).join(" ");
        for (const value of splitByCommonDelimiters(afterLike)) {
            interests.push(toSignal(value, message, "chat", 0.78));
        }
    }
    if (lowered.includes("i don't like") || lowered.includes("i dislike") || lowered.includes("i hate")) {
        const afterDislike = message.split(/i don't like|i dislike|i hate/gi).slice(1).join(" ");
        for (const value of splitByCommonDelimiters(afterDislike)) {
            dislikes.push(toSignal(value, message, "chat", 0.78));
        }
    }
    if (lowered.includes("i want") || lowered.includes("goal")) {
        motivations.push(toSignal(message, message, "chat", 0.65));
    }
    if (lowered.includes("backend") || lowered.includes("frontend") || lowered.includes("fullstack") || lowered.includes("qa")) {
        const roleHints = ["Backend Engineer", "Frontend Engineer", "Fullstack Engineer", "QA Engineer"];
        const matched = roleHints.filter((item) => lowered.includes(item.split(" ")[0]?.toLowerCase() ?? ""));
        for (const role of matched) {
            preferredRoles.push(toSignal(role, message, "llm_inference", 0.58));
        }
    }

    const uncertaintyLevel = lowered.includes("don't know") || lowered.includes("not sure") || lowered.includes("no idea")
        ? 0.85
        : lowered.includes("i want") || preferredRoles.length > 0
            ? 0.35
            : undefined;

    return {
        technologies,
        interests,
        dislikes,
        motivations,
        preferredRoles,
        extractedKeywords: [...extractKnownTechnologies(message), ...splitByCommonDelimiters(message).slice(0, 4)].map((item) => toSignal(item, message, "llm_inference", 0.52)),
        uncertaintyLevel,
    };
};

const inferTechnologiesFromText = (text: string): string[] => extractKnownTechnologies(text);

const inferInterestsFromText = (text: string): string[] => {
    const normalized = text.toLowerCase();
    const candidates = [
        "automation",
        "testing",
        "backend",
        "frontend",
        "devops",
        "data",
        "analytics",
        "security",
        "product",
        "ai",
        "ml",
        "reliability",
        "debugging",
        "systems",
    ];
    return candidates.filter((item) => normalized.includes(item));
};

export const inferProfileUpdateFromProfileInput = (profile?: ProfileInput): CareerProfileSignalUpdate => {
    if (!profile) {
        return {};
    }

    const evidenceText = [
        profile.currentJob ?? "",
        ...(profile.achievements?.map((item) => item.name) ?? []),
        ...(profile.technologies ?? []),
        ...(profile.interests ?? []),
    ].join(" | ");

    const technologies = dedupeStrings([
        ...(profile.technologies ?? []),
        ...inferTechnologiesFromText(evidenceText),
    ]);

    const interests = dedupeStrings([
        ...(profile.interests ?? []),
        ...inferInterestsFromText(evidenceText),
    ]);

    const shortTermGoal = profile.currentJob?.trim()
        ? `Current role context: ${profile.currentJob.trim()}`
        : null;

    return {
        technologies: technologies.map((value) => toSignal(value, evidenceText, "cv", 0.82)),
        interests: interests.map((value) => toSignal(value, evidenceText, "cv", 0.72)),
        shortTermGoals: shortTermGoal ? [toSignal(shortTermGoal, evidenceText, "cv", 0.58)] : [],
        extractedKeywords: dedupeStrings([...technologies, ...interests]).map((value) => toSignal(value, evidenceText, "cv", 0.55)),
    };
};

export class CareerProfileService {
    constructor(
        private readonly repository: CareerProfileRepository,
        private readonly embedding: EmbeddingPort
    ) { }

    getOrCreateProfile = async (userId: string): Promise<UserCareerProfile> => {
        const existing = await this.repository.findByUserId(userId);
        if (existing) {
            return existing;
        }
        const created = buildDefaultProfile(userId);
        created.profileSummaryText = toProfileSummaryText(created);
        created.profileSummaryEmbedding = await this.embedding.embedCareerProfile(created.profileSummaryText).catch(() => []);
        await this.repository.upsertByUserId(created);
        return created;
    };

    mergeProfileSignals = async (existingProfile: UserCareerProfile, updates: CareerProfileSignalUpdate): Promise<UserCareerProfile> => {
        const merged = mergeProfileSignals(existingProfile, updates);
        const summary = toProfileSummaryText(merged);
        const summaryEmbedding = await this.embedding.embedCareerProfile(summary).catch(() => existingProfile.profileSummaryEmbedding);
        const nextProfile: UserCareerProfile = {
            ...merged,
            profileSummaryText: summary,
            profileSummaryEmbedding: summaryEmbedding,
            updatedAt: new Date(),
        };
        await this.repository.upsertByUserId(nextProfile);
        return nextProfile;
    };

    updateProfileFromConversation = async (
        userId: string,
        message: string,
        _conversationContext: Conversation
    ): Promise<UserCareerProfile> => {
        const existing = await this.getOrCreateProfile(userId);
        const updates = inferProfileUpdateFromMessage(message);
        return this.mergeProfileSignals(existing, updates);
    };

    updateProfileFromInput = async (userId: string, profile?: ProfileInput): Promise<UserCareerProfile> => {
        const existing = await this.getOrCreateProfile(userId);
        const updates = inferProfileUpdateFromProfileInput(profile);
        return this.mergeProfileSignals(existing, updates);
    };
}
