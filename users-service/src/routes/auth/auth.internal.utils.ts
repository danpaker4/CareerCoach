export const getInternalServiceApiKey = (): string | undefined => {
    const configuredKey = process.env.INTERNAL_SERVICE_API_KEY?.trim();
    if (configuredKey === undefined || configuredKey.length === 0) {
        return "local-dev-internal-service-key";
    }

    return configuredKey;
};

export const readInternalServiceUserId = (headers: Record<string, string | string[] | undefined>): string | null => {
    const rawUserId = headers["x-service-user-id"];
    if (typeof rawUserId === "string" && rawUserId.trim().length > 0) {
        return rawUserId.trim();
    }

    if (Array.isArray(rawUserId)) {
        const firstUserId = rawUserId.find((value) => value.trim().length > 0);
        return firstUserId?.trim() ?? null;
    }

    return null;
};

export const readInternalServiceApiKeyHeader = (
    headers: Record<string, string | string[] | undefined>,
): string | null => {
    const rawKey = headers["x-internal-service-key"];
    if (typeof rawKey === "string" && rawKey.trim().length > 0) {
        return rawKey.trim();
    }

    if (Array.isArray(rawKey)) {
        const firstKey = rawKey.find((value) => value.trim().length > 0);
        return firstKey?.trim() ?? null;
    }

    return null;
};
