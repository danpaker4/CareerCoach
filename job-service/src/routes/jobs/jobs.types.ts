import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";

export type JobsRankingMode = "profile" | "profile_query" | "query" | "recent" | "keyword";

export interface JobResult {
    readonly id: string;
    readonly jobTitle: string;
    readonly company: string;
    readonly seniority: string;
    readonly description: string;
    readonly url: string;
    readonly salary?: number;
    readonly requirements?: string[];
    readonly benefits?: string[];
    readonly matchPct?: number;
}

export interface JobsPageResponse {
    readonly jobs: JobResult[];
    readonly pagination: {
        readonly pageSize: 50;
        readonly nextCursor: string | null;
        readonly hasMore: boolean;
    };
    readonly rankingMode: JobsRankingMode;
}

export interface JobsCursor {
    readonly offset: number;
    readonly asOf: string;
    readonly rankingFingerprint: string;
}

export type RankedJob = EnrichedJob & {
    readonly vectorScore?: number;
};

export interface JobsPageQuery {
    readonly userId: string;
    readonly search?: string;
    readonly cursor?: string;
}

export interface JobsRankingStrategy {
    readonly vector: number[] | null;
    readonly mode: JobsRankingMode;
    /** Vector used for matchPct / fit filtering (query when searching, profile when browsing). */
    readonly scoreVector: number[] | null;
    readonly searchTerm: string;
}
