import type { Conversation } from "../conversation/conversation.model";
import type { ProfileInput } from "../conversation/conversation.types";
import type { EmbeddingPort } from "../../ai/embedding/embedding.types";
import type { TextCompletionPort } from "../../litellm/text-completion/text-completion.types";
import type { CareerProfileSignalUpdate, CoachProfileAccountLink, UserCareerProfile } from "./career-profile.types";
import {
    hasUsableProfileInput,
    inferProfileUpdateFromProfileInputWithLlm,
} from "./llm/career-profile.llm.utils";
import { inferProfileUpdateFromMessage } from "./message-inference/career-profile.message-inference.utils";
import { CareerProfileDal } from "./dal/career-profile.dal";
import {
    createEmptyProfileSignals,
    mergeProfileSignals,
    toProfileSummaryText,
} from "./signals/career-profile.signals.utils";

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

export class CareerProfileService {
    constructor(
        private readonly dal: CareerProfileDal,
        private readonly embedding: EmbeddingPort,
        private readonly textCompletion: TextCompletionPort,
        private readonly accountLink: CoachProfileAccountLink | null = null
    ) { }

    getProfile = async (userId: string): Promise<UserCareerProfile> => {
        const existing = await this.dal.findByUserId(userId);
        if (existing) {
            return existing;
        }
        const created = buildDefaultProfile(userId);
        created.profileSummaryText = toProfileSummaryText(created);
        created.profileSummaryEmbedding = await this.embedding.embedCareerProfile(created.profileSummaryText).catch(() => []);
        await this.dal.upsertByUserId(created);
        await this.accountLink?.notifyProfileMaterialized(userId).catch(() => null);
        return created;
    };

    mergeProfileSignals = async (
        existingProfile: UserCareerProfile,
        updates: CareerProfileSignalUpdate
    ): Promise<UserCareerProfile> => {
        const merged = mergeProfileSignals(existingProfile, updates);
        const summary = toProfileSummaryText(merged);
        const summaryEmbedding = await this.embedding
            .embedCareerProfile(summary)
            .catch(() => existingProfile.profileSummaryEmbedding);
        const nextProfile: UserCareerProfile = {
            ...merged,
            profileSummaryText: summary,
            profileSummaryEmbedding: summaryEmbedding,
            updatedAt: new Date(),
        };
        await this.dal.upsertByUserId(nextProfile);
        return nextProfile;
    };

    updateProfileFromConversation = async (
        userId: string,
        message: string,
        _conversationContext: Conversation
    ): Promise<UserCareerProfile> => {
        const existing = await this.getProfile(userId);
        const updates = inferProfileUpdateFromMessage(message);
        return this.mergeProfileSignals(existing, updates);
    };

    updateProfileFromInput = async (userId: string, profile?: ProfileInput): Promise<UserCareerProfile> => {
        const existing = await this.getProfile(userId);
        if (!hasUsableProfileInput(profile)) {
            return existing;
        }
        const updates = await inferProfileUpdateFromProfileInputWithLlm(this.textCompletion, userId, profile);
        return this.mergeProfileSignals(existing, updates);
    };
}
