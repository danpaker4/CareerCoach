export const resolveRequestAuthorization = (
    authorizationHeader: string | string[] | undefined,
    accessToken?: string,
): string | undefined => {
    if (typeof authorizationHeader === "string" && authorizationHeader.trim().length > 0) {
        return authorizationHeader;
    }

    if (Array.isArray(authorizationHeader)) {
        const firstHeader = authorizationHeader.find((value) => value.trim().length > 0);
        if (firstHeader !== undefined) {
            return firstHeader;
        }
    }

    if (typeof accessToken === "string" && accessToken.trim().length > 0) {
        const trimmedToken = accessToken.trim();
        return trimmedToken.startsWith("Bearer ") ? trimmedToken : `Bearer ${trimmedToken}`;
    }

    return undefined;
};
