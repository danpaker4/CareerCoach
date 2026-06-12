import type { GeneratedResource, GeneratedStageContent, ResourceType, RoadmapGenerationResponse } from "./roadmap-generation.types";

const PLATFORM_SEARCH_URLS: Record<string, (query: string) => string> = {
    udemy: (q) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(q)}`,
    coursera: (q) => `https://www.coursera.org/search?query=${encodeURIComponent(q)}`,
    youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    pluralsight: (q) => `https://www.pluralsight.com/search?q=${encodeURIComponent(q)}`,
    medium: (q) => `https://medium.com/search?q=${encodeURIComponent(q)}`,
    "dev.to": (q) => `https://dev.to/search?q=${encodeURIComponent(q)}`,
    freecodecamp: (q) => `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(q)}`,
    "official docs": (q) => `https://www.google.com/search?q=${encodeURIComponent(q + " official documentation")}`,
    github: (q) => `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`,
    leetcode: (q) => `https://leetcode.com/problemset/?search=${encodeURIComponent(q)}`,
    hackerrank: (q) => `https://www.hackerrank.com/domains?filters%5Bsubdomains%5D%5B%5D=${encodeURIComponent(q)}`,
    "stack overflow": (q) => `https://stackoverflow.com/search?q=${encodeURIComponent(q)}`,
    mdn: (q) => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`,
    "aws training": (q) => `https://www.aws.training/search?searchPhrase=${encodeURIComponent(q)}`,
    "google cloud": (q) => `https://cloud.google.com/s/results/${encodeURIComponent(q)}`,
    "linkedin learning": (q) => `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(q)}`,
    codecademy: (q) => `https://www.codecademy.com/search?query=${encodeURIComponent(q)}`,
    edx: (q) => `https://www.edx.org/search?q=${encodeURIComponent(q)}`,
    kaggle: (q) => `https://www.kaggle.com/search?q=${encodeURIComponent(q)}`,
};

const PLATFORM_TYPE_MAP: Record<string, ResourceType> = {
    udemy: "course",
    coursera: "course",
    pluralsight: "course",
    "linkedin learning": "course",
    codecademy: "course",
    edx: "course",
    youtube: "video",
    leetcode: "practice",
    hackerrank: "practice",
    kaggle: "practice",
    medium: "article",
    "dev.to": "article",
    freecodecamp: "article",
    "stack overflow": "article",
    "official docs": "docs",
    mdn: "docs",
    github: "repository",
    "aws training": "certification",
    "google cloud": "certification",
};

const deriveResourceType = (platform: string): ResourceType =>
    PLATFORM_TYPE_MAP[platform.toLowerCase()] ?? "article";

const buildResourceUrl = (title: string, platform: string): string => {
    const key = platform.toLowerCase();
    const builder = PLATFORM_SEARCH_URLS[key];
    return builder ? builder(title) : `https://www.google.com/search?q=${encodeURIComponent(title + " " + platform)}`;
};

type RawStage = Record<string, unknown>;

const hasValidCoreFields = (obj: RawStage): boolean =>
    typeof obj.label === "string" &&
    obj.label.trim().length > 0 &&
    typeof obj.description === "string" &&
    Array.isArray(obj.actions) &&
    obj.actions.every((a: unknown) => typeof a === "string");

const extractJsonFromResponse = (raw: string): string => {
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    return codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();
};

const extractObjectLikeJson = (raw: string): string | null => {
    const firstBraceIndex = raw.indexOf("{");
    const lastBraceIndex = raw.lastIndexOf("}");
    if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
        return null;
    }
    return raw.slice(firstBraceIndex, lastBraceIndex + 1).trim();
};

const tryParseJsonCandidates = (rawText: string): unknown => {
    const trimmed = rawText.trim();
    const extractedFromCodeBlock = extractJsonFromResponse(rawText);
    const objectLike = extractObjectLikeJson(trimmed);
    const candidates = [...new Set([extractedFromCodeBlock, trimmed, objectLike].filter((item): item is string => Boolean(item)))];

    const parsed = candidates
        .map((candidate) => {
            try {
                return { ok: true as const, value: JSON.parse(candidate) };
            } catch {
                return { ok: false as const };
            }
        })
        .find((result) => result.ok === true);

    if (parsed && parsed.ok) {
        return parsed.value;
    }

    throw new Error("LLM returned invalid JSON roadmap payload");
};

const parseResources = (raw: unknown): GeneratedResource[] => {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .filter((r: unknown): r is Record<string, unknown> =>
            typeof r === "object" && r !== null &&
            typeof (r as Record<string, unknown>).title === "string" &&
            typeof (r as Record<string, unknown>).platform === "string"
        )
        .map((r) => {
            const title = (r.title as string).trim();
            const platform = (r.platform as string).trim();
            return {
                title,
                platform,
                url: buildResourceUrl(title, platform),
                type: deriveResourceType(platform),
            };
        })
        .filter((r) => r.title.length > 0);
};

export const parseRoadmapGenerationResponse = (
    rawText: string,
    expectedStageCount: number
): RoadmapGenerationResponse => {
    const parsed = tryParseJsonCandidates(rawText);

    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object roadmap payload");
    }

    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.stages)) {
        throw new Error("LLM response missing 'stages' array");
    }

    const validStages = obj.stages.filter(
        (s: unknown): s is RawStage =>
            typeof s === "object" && s !== null && hasValidCoreFields(s as RawStage)
    );
    if (validStages.length === 0) {
        throw new Error("No valid stages in LLM response");
    }

    const stages: GeneratedStageContent[] = validStages
        .slice(0, expectedStageCount)
        .map((stage) => ({
            label: (stage.label as string).trim(),
            description: (stage.description as string).trim(),
            actions: (stage.actions as string[])
                .map((a) => (typeof a === "string" ? a.trim() : String(a)))
                .filter(Boolean),
            resources: parseResources(stage.resources),
            estimatedTimeframe:
                typeof stage.estimatedTimeframe === "string"
                    ? (stage.estimatedTimeframe as string).trim()
                    : "",
        }));

    return { stages };
};
