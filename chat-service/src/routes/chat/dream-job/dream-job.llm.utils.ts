import type { DreamJobLlmPayload } from "../career-planning/career-planning.types";

export const extractJsonObjectFromModelText = (raw: string): string => {
    const trimmed = raw.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence?.[1]?.trim() ?? trimmed;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        return candidate;
    }
    return candidate.slice(start, end + 1);
};

export const parseDreamJobPayloadFromRaw = (rawText: string): DreamJobLlmPayload | null => {
    try {
        const parsed: unknown = JSON.parse(extractJsonObjectFromModelText(rawText));
        if (typeof parsed !== "object" || parsed === null) {
            return null;
        }
        const obj = parsed as Record<string, unknown>;
        const dreamJobRaw = obj.dreamJob;
        const dreamJob =
            dreamJobRaw === null
                ? ""
                : typeof dreamJobRaw === "string"
                    ? dreamJobRaw.trim()
                    : "";
        const confidence = typeof obj.confidence === "number" && Number.isFinite(obj.confidence) ? obj.confidence : 0;
        const reasoning = Array.isArray(obj.reasoning)
            ? obj.reasoning.filter((item): item is string => typeof item === "string").map((item) => item.trim())
            : [];
        if (dreamJob.length === 0) {
            return null;
        }
        return { dreamJob, confidence, reasoning };
    } catch {
        return null;
    }
};
