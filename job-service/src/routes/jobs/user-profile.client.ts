interface UserProfileResponse {
    profileEmbedding?: number[];
}

export const fetchUserProfileEmbedding = async (
    usersServiceBaseUrl: string,
    userId: string
): Promise<number[] | null> => {
    try {
        const response = await fetch(
            `${usersServiceBaseUrl}/users/${encodeURIComponent(userId)}`
        );
        if (!response.ok) return null;

        const user = (await response.json()) as UserProfileResponse;
        const embedding = user?.profileEmbedding;
        return Array.isArray(embedding) && embedding.length > 0
            ? embedding
            : null;
    } catch {
        return null;
    }
};
