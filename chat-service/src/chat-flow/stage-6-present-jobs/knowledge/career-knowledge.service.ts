import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../../routes/external-chat-tools/role-experience.types";
import type { CareerDirectionExample, CareerDirectionSuggestion, SuggestDirectionsDeps } from "./career-knowledge.types";

export const suggestDirections = async (
    deps: SuggestDirectionsDeps,
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

    const vector = await deps.embedding.embedCareerDirection(query).catch(() => []);
    if (vector.length === 0) {
        return [];
    }

    const results = await deps.directionCollection.aggregate([
        {
            $vectorSearch: {
                index: deps.directionVectorIndexName,
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

export const createSuggestDirections = (deps: SuggestDirectionsDeps) =>
    (profile: UserCareerProfile, roleExperience: readonly RoleExperienceEntry[] = [], limit = 3) =>
        suggestDirections(deps, profile, roleExperience, limit);
