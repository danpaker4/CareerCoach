import type { Collection } from "mongodb";
import type { EmbeddingPort } from "../../../ai/ports/embedding.types";
import type { UserCareerProfile } from "../../career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../external-chat/role-experience.types";
import type { CareerDirectionExample, CareerDirectionSuggestion } from "./career-knowledge.types";

export class CareerKnowledgeService {
    constructor(
        private readonly directionCollection: Collection<CareerDirectionExample>,
        private readonly embedding: EmbeddingPort,
        private readonly directionVectorIndexName: string
    ) { }

    suggestDirections = async (
        profile: UserCareerProfile,
        roleExperience: readonly RoleExperienceEntry[] = [],
        limit = 3
    ): Promise<CareerDirectionSuggestion[]> => {
        const query = [
            ...profile.interests.map((item) => item.value),
            ...profile.technologies.map((item) => item.value),
            ...roleExperience.map((item) => `${item.displayLabel} ${item.level}`),
        ].join(" ");
        if (!query.trim()) {
            return [];
        }

        const vector = await this.embedding.embedCareerDirection(query).catch(() => []);
        if (vector.length === 0) {
            return [];
        }

        const results = await this.directionCollection.aggregate([
            {
                $vectorSearch: {
                    index: this.directionVectorIndexName,
                    path: "embedding",
                    queryVector: vector,
                    numCandidates: Math.max(limit * 8, 24),
                    limit,
                },
            },
            {
                $project: {
                    _id: 0,
                    directionName: 1,
                    description: 1,
                    exampleRoles: 1,
                },
            },
        ]).toArray().catch(() => []);

        return (results as Array<Pick<CareerDirectionExample, "directionName" | "description" | "exampleRoles">>).map((item) => ({
            directionName: item.directionName,
            why: item.description,
            exampleRoles: item.exampleRoles.slice(0, 3),
        }));
    };
}
