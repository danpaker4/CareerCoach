import type { UserMatchingContext } from "../../cache/user-embedding.cache";

interface UserProfileResponse {
    profileEmbedding?: number[];
    profileEmbeddingUpdatedAt?: string;
    profileEmbeddingModel?: string;
    profileEmbeddingStatus?: "pending" | "ready" | "failed";
}

export const fetchUserMatchingContext = async (
    usersServiceBaseUrl: string,
    userId: string,
    internalServiceApiKey: string,
): Promise<UserMatchingContext | null> => {
    try {
        const response = await fetch(
            `${usersServiceBaseUrl}/users/${encodeURIComponent(userId)}/job-matching-context`,
            {
                headers: {
                    "X-Internal-Service-Key": internalServiceApiKey,
                    "X-Service-User-Id": userId,
                },
            },
        );
        if (!response.ok) return null;

        const user = (await response.json()) as UserProfileResponse;
        const embedding = user?.profileEmbedding;
        if (!Array.isArray(embedding) || embedding.length === 0) return null;
        const updatedAt = typeof user.profileEmbeddingUpdatedAt === "string"
            ? new Date(user.profileEmbeddingUpdatedAt)
            : null;
        return {
            embedding,
            updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
            model: typeof user.profileEmbeddingModel === "string" ? user.profileEmbeddingModel : null,
            status: user.profileEmbeddingStatus ?? null,
        };
    } catch {
        return null;
    }
};
