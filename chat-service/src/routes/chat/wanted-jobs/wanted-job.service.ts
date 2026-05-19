import type { JobSearchRequest } from "../chat.types";

export type WantedJobCreateInput = {
    userId: string;
    jobTitle: string;
    keywords: string[];
    location?: string;
    seniority?: string;
    rawText: string;
};

export type CreateWantedJobResult =
    | { status: "created" | "existing"; jobTitle: string }
    | { status: "error"; message: string };

export const buildWantedJobInputFromSearch = (params: {
    userId: string;
    normalizedMessage: string;
    searchFilters: JobSearchRequest;
}): WantedJobCreateInput | null => {
    const { userId, normalizedMessage, searchFilters } = params;
    const keywords = [
        ...searchFilters.keywords,
        ...searchFilters.skills,
        ...searchFilters.interests,
    ]
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

    const dedupedKeywords = Array.from(new Set(keywords.map((k) => k.toLowerCase())))
        .map((lower) => keywords.find((k) => k.toLowerCase() === lower) ?? lower);

    const inferredTitle =
        searchFilters.keywords[0]?.trim() ||
        searchFilters.interests[0]?.trim() ||
        searchFilters.skills[0]?.trim() ||
        "";

    if (inferredTitle.length === 0 && dedupedKeywords.length === 0) {
        return null;
    }

    const seniority = searchFilters.experienceLevel?.trim() || undefined;
    return {
        userId,
        jobTitle: inferredTitle || dedupedKeywords[0],
        keywords: dedupedKeywords,
        seniority,
        rawText: normalizedMessage.trim().slice(0, 1000),
    };
};

export class WantedJobService {
    constructor(private readonly jobServiceBaseUrl: string) { }

    create = async (input: WantedJobCreateInput): Promise<CreateWantedJobResult> => {
        const body = {
            userId: input.userId,
            jobTitle: input.jobTitle,
            keywords: input.keywords,
            seniority: input.seniority,
            location: input.location,
            rawText: input.rawText,
        };

        let response: Response;
        try {
            response = await fetch(`${this.jobServiceBaseUrl}/wanted-jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Network error",
            };
        }

        if (response.status === 201) {
            const payload = await response.json().catch(() => null);
            const created = typeof payload === "object" && payload !== null && "createdAt" in payload;
            return { status: created ? "created" : "existing", jobTitle: input.jobTitle };
        }

        const errorText = await response.text().catch(() => "");
        return {
            status: "error",
            message: errorText.length > 0 ? errorText : `Wanted-job request failed with status ${response.status}`,
        };
    };
}
