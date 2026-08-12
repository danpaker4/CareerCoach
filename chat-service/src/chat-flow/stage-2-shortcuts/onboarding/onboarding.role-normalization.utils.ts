const normalizeRoleToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9+#.]/g, "");

const editDistance = (left: string, right: string): number => {
    const initialRow = Array.from({ length: right.length + 1 }, (_, index) => index);
    const finalRow = [...left].reduce<number[]>((previousRow, leftCharacter, leftIndex) =>
        [...right].reduce<number[]>((currentRow, rightCharacter, rightIndex) => {
            const insertion = (currentRow[rightIndex] ?? 0) + 1;
            const deletion = (previousRow[rightIndex + 1] ?? 0) + 1;
            const substitution = (previousRow[rightIndex] ?? 0) + (leftCharacter === rightCharacter ? 0 : 1);
            return [...currentRow, Math.min(insertion, deletion, substitution)];
        }, [leftIndex + 1]), initialRow);
    return finalRow.at(-1) ?? Math.max(left.length, right.length);
};

const typoDistanceLimit = (tokenLength: number): number => {
    if (tokenLength <= 4) return 1;
    if (tokenLength <= 8) return 2;
    return Math.max(2, Math.floor(tokenLength * 0.25));
};

const tokenizeRole = (role: string): string[] =>
    role.split(/\s+/).map(normalizeRoleToken).filter((token) => token.length > 1);

const correctedRoleMatchesClaim = (claimedRole: string, correctedRole: string): boolean => {
    const claimedTokens = tokenizeRole(claimedRole);
    const correctedTokens = tokenizeRole(correctedRole);
    if (claimedTokens.length === 0 || correctedTokens.length === 0) return false;

    return correctedTokens.every((correctedToken) =>
        claimedTokens.some((claimedToken) =>
            editDistance(claimedToken, correctedToken) <= typoDistanceLimit(correctedToken.length)));
};

export const resolveNormalizedChatRole = (claimedRole: string, modelRole: string | null | undefined): string => {
    const normalizedModelRole = modelRole?.trim();
    if (!normalizedModelRole || !correctedRoleMatchesClaim(claimedRole, normalizedModelRole)) {
        return claimedRole.trim();
    }
    return normalizedModelRole;
};
