import type { Collection } from "mongodb";
import type { EmbeddingPort } from "../../ai/ports/embedding.types";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../external-chat/role-experience.types";
import { CareerKnowledgeService } from "../chat/knowledge/career-knowledge.service";
import type { CareerDirectionExample, CareerDirectionSuggestion } from "../chat/knowledge/career-knowledge.types";

export class BenchmarkNoopEmbeddingPort implements EmbeddingPort {
    readonly embedText = async (_text: string): Promise<number[]> => [];

    readonly embedJob = async (_text: string): Promise<number[]> => [];

    readonly embedCareerProfile = async (_text: string): Promise<number[]> => [];

    readonly embedCareerDirection = async (_text: string): Promise<number[]> => [];
}

export class BenchmarkNoopCareerKnowledgeService extends CareerKnowledgeService {
    constructor(directionCollection: Collection<CareerDirectionExample>) {
        super(directionCollection, new BenchmarkNoopEmbeddingPort(), "benchmark_noop");
    }

    override suggestDirections = async (
        _profile: UserCareerProfile,
        _roleExperience: readonly RoleExperienceEntry[] = [],
        _limit = 3
    ): Promise<CareerDirectionSuggestion[]> => [];
}
