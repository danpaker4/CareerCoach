import { CAPABILITY_BY_ID, CAPABILITY_CATALOG } from "./capability-catalog.consts";
import type { CapabilityDefinition, NormalizedCapability } from "./capability-catalog.types";
import { isCredentialLikeText } from "./role-archetype.consts";

const normalizeText = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9+#.\s/-]/g, " ")
        .replace(/\s+/g, " ");

const aliasIndex = (() => {
    const index = new Map<string, CapabilityDefinition>();
    for (const capability of CAPABILITY_CATALOG) {
        index.set(normalizeText(capability.label), capability);
        for (const alias of capability.aliases) {
            index.set(normalizeText(alias), capability);
        }
    }
    return index;
})();

export const slugifyCapabilityId = (sourceText: string): string => {
    const slug = normalizeText(sourceText)
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 64);
    return slug.length > 0 ? `cap.dynamic.${slug}` : "cap.dynamic.unknown";
};

const matchByAliasInclusion = (normalized: string): CapabilityDefinition | undefined => {
    const ranked = [...aliasIndex.entries()]
        .filter(([alias]) => alias.length >= 3 && (normalized.includes(alias) || alias.includes(normalized)))
        .sort((a, b) => b[0].length - a[0].length);
    return ranked[0]?.[1];
};

export const normalizeCapabilityText = (sourceText: string): NormalizedCapability => {
    const normalized = normalizeText(sourceText);
    if (!normalized) {
        return {
            id: "cap.dynamic.unknown",
            label: sourceText.trim() || "Unknown capability",
            category: "technical",
            sourceText,
        };
    }

    if (isCredentialLikeText(normalized)) {
        const degree = CAPABILITY_BY_ID.get("cap.credential.cs.degree");
        if (degree) {
            return {
                id: degree.id,
                label: degree.label,
                category: degree.category,
                sourceText,
            };
        }
    }

    const exact = aliasIndex.get(normalized);
    if (exact) {
        return {
            id: exact.id,
            label: exact.label,
            category: exact.category,
            sourceText,
        };
    }

    const fuzzy = matchByAliasInclusion(normalized);
    if (fuzzy) {
        return {
            id: fuzzy.id,
            label: fuzzy.label,
            category: fuzzy.category,
            sourceText,
        };
    }

    return {
        id: slugifyCapabilityId(sourceText),
        label: sourceText.trim(),
        category: "technical",
        sourceText,
    };
};

export const normalizeCapabilityTexts = (texts: readonly string[]): NormalizedCapability[] => {
    const seen = new Set<string>();
    const results: NormalizedCapability[] = [];
    for (const text of texts) {
        if (typeof text !== "string" || text.trim().length === 0) continue;
        const normalized = normalizeCapabilityText(text);
        if (seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        results.push(normalized);
    }
    return results;
};

export const getCatalogCapability = (id: string): CapabilityDefinition | undefined => CAPABILITY_BY_ID.get(id);

export const getCapabilityDependencies = (id: string): readonly string[] =>
    CAPABILITY_BY_ID.get(id)?.dependsOn ?? [];

export const getCapabilityMinCalendarWeeks = (id: string): number =>
    CAPABILITY_BY_ID.get(id)?.minCalendarWeeks ?? 4;
