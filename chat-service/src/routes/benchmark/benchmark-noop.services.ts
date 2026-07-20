import type { Collection } from "mongodb";
import type { EmbeddingPort } from "../../ai/embedding/embedding.types";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../external-chat-tools/role-experience.types";
import type { CareerDirectionExample, CareerDirectionSuggestion } from "../../chat-flow/stage-6-present-jobs/knowledge/career-knowledge.types";
import type { SuggestDirections } from "../../chat-flow/chat-flow.types";

export class BenchmarkNoopEmbeddingPort implements EmbeddingPort {
    readonly embedText = async (_text: string): Promise<number[]> => [];

    readonly embedJob = async (_text: string): Promise<number[]> => [];

    readonly embedCareerProfile = async (_text: string): Promise<number[]> => [];

    readonly embedCareerDirection = async (_text: string): Promise<number[]> => [];
}

export const createBenchmarkNoopSuggestDirections = (
    _directionCollection: Collection<CareerDirectionExample>
): SuggestDirections =>
    async (
        _profile: UserCareerProfile,
        _roleExperience: readonly RoleExperienceEntry[] = [],
        _limit = 3
    ): Promise<CareerDirectionSuggestion[]> => [];
