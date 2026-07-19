import { MAX_ARRAY_ITEMS } from "./user-account-context.consts";

export const readString = (value: unknown): string | null => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const readStringArray = (value: unknown): readonly string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
};

export const mergeUniqueStrings = (...groups: readonly (readonly string[])[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const group of groups) {
        for (const item of group) {
            const key = item.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                out.push(item);
            }
        }
    }
    return out.slice(0, MAX_ARRAY_ITEMS);
};
