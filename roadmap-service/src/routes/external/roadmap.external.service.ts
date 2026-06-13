import type { Collection } from "mongodb";
import type { JobSearchRequest, JobSearchResultItem } from "./job-search.utils";
import { isJobSearchResultItem, normalizeFilters, normalizeJobSearchResultItem } from "./job-search.utils";
import type { MarketRequirementsContext } from "../roadmap-generation/gap-analysis.types";

export type CareerPathSummary = {
    fromRole: string;
    toRole: string;
    requiredSkills: string[];
    overlapScore: number;
};

export type CareerProfileSummary = {
    senioritySignal: string | null;
    preferredRoles: string[];
    longTermGoals: string[];
    preferredDomains: string[];
    softSkills: string[];
    technologies: string[];
};

export class RoadmapExternalService {
    constructor(
        private readonly usersServiceBaseUrl: string,
        private readonly jobServiceBaseUrl: string,
        private readonly chatServiceBaseUrl: string,
        private readonly internalServiceApiKey: string
    ) {}

    private internalHeaders = (userId?: string): Record<string, string> => ({
        "X-Internal-Service-Key": this.internalServiceApiKey,
        ...(userId ? { "X-Service-User-Id": userId } : {}),
    });

    readUserPublicProfile = async (userId: string): Promise<Record<string, unknown> | null> => {
        const response = await fetch(`${this.usersServiceBaseUrl}/users/${encodeURIComponent(userId)}`, {
            headers: this.internalHeaders(userId),
        });
        if (!response.ok) return null;
        const payload: unknown = await response.json().catch(() => null);
        if (typeof payload !== "object" || payload === null) return null;
        const record = { ...(payload as Record<string, unknown>) };
        delete record.password;
        return record;
    };

    readCareerProfile = async (userId: string): Promise<CareerProfileSummary | null> => {
        const response = await fetch(
            `${this.chatServiceBaseUrl}/internal/users/${encodeURIComponent(userId)}/career-profile`,
            { headers: this.internalHeaders() }
        );
        if (!response.ok) return null;
        const payload: unknown = await response.json().catch(() => null);
        if (typeof payload !== "object" || payload === null) return null;
        const profile = payload as Record<string, unknown>;
        const readSignals = (key: string): string[] => {
            const bucket = profile[key];
            if (!Array.isArray(bucket)) return [];
            return bucket
                .filter((item): item is { value: string } => typeof item === "object" && item !== null && "value" in item && typeof (item as { value: unknown }).value === "string")
                .map((item) => item.value);
        };
        return {
            senioritySignal: typeof profile.senioritySignal === "string" ? profile.senioritySignal : null,
            preferredRoles: readSignals("preferredRoles"),
            longTermGoals: readSignals("longTermGoals"),
            preferredDomains: readSignals("preferredDomains"),
            softSkills: readSignals("softSkills"),
            technologies: readSignals("technologies"),
        };
    };

    searchJobs = async (filters: JobSearchRequest): Promise<JobSearchResultItem[]> => {
        const response = await fetch(`${this.jobServiceBaseUrl}/jobs/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalizeFilters(filters)),
        });
        if (!response.ok) return [];
        const payload: unknown = await response.json().catch(() => []);
        return Array.isArray(payload)
            ? payload.filter(isJobSearchResultItem).map(normalizeJobSearchResultItem).slice(0, 15)
            : [];
    };

    getMarketRequirements = async (roleCategory: string): Promise<MarketRequirementsContext | null> => {
        const params = new URLSearchParams({ roleCategory });
        const response = await fetch(`${this.jobServiceBaseUrl}/career-knowledge/market-requirements?${params.toString()}`);
        if (!response.ok) return null;
        const payload: unknown = await response.json().catch(() => null);
        if (typeof payload !== "object" || payload === null) return null;
        const data = payload as Record<string, unknown>;
        return {
            roleCategory: String(data.roleCategory ?? roleCategory),
            commonSkills: Array.isArray(data.commonSkills) ? data.commonSkills.filter((s): s is string => typeof s === "string") : [],
            responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities.filter((s): s is string => typeof s === "string") : [],
            leadershipSignals: Array.isArray(data.leadershipSignals) ? data.leadershipSignals.filter((s): s is string => typeof s === "string") : [],
            architectureSignals: Array.isArray(data.architectureSignals) ? data.architectureSignals.filter((s): s is string => typeof s === "string") : [],
            seniorityDistribution: typeof data.seniorityDistribution === "object" && data.seniorityDistribution !== null
                ? Object.fromEntries(
                    Object.entries(data.seniorityDistribution as Record<string, unknown>).filter(([, v]) => typeof v === "number")
                ) as Record<string, number>
                : {},
        };
    };

    getCareerPaths = async (fromRole: string, toRole: string): Promise<CareerPathSummary[]> => {
        const params = new URLSearchParams({ fromRole, toRole });
        const response = await fetch(`${this.jobServiceBaseUrl}/career-knowledge/paths?${params.toString()}`);
        if (!response.ok) return [];
        const payload: unknown = await response.json().catch(() => null);
        if (typeof payload !== "object" || payload === null || !("paths" in payload)) return [];
        const paths = (payload as { paths: unknown }).paths;
        if (!Array.isArray(paths)) return [];
        return paths
            .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
            .map((p) => ({
                fromRole: String(p.fromRole ?? ""),
                toRole: String(p.toRole ?? ""),
                requiredSkills: Array.isArray(p.requiredSkills) ? p.requiredSkills.filter((s): s is string => typeof s === "string") : [],
                overlapScore: typeof p.overlapScore === "number" ? p.overlapScore : 0,
            }))
            .filter((p) => p.fromRole.length > 0 && p.toRole.length > 0);
    };

    refreshCareerKnowledge = async (): Promise<void> => {
        await fetch(`${this.jobServiceBaseUrl}/career-knowledge/refresh`, { method: "POST" }).catch(() => undefined);
    };
}
