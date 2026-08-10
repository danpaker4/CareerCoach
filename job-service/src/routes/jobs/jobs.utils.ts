import { createHash } from "node:crypto";
import { z } from "zod";
import type { UserMatchingContext } from "../../cache/user-embedding.cache";
import { cosineSimilarity, computeVectorMatchScore } from "../jobScores/vector-score.service";
import {
    JOBS_LIST_MIN_MATCH_FIT_PCT,
    JOBS_PAGE_LOOKAHEAD,
    JOBS_PAGE_SIZE,
    SEARCH_LEXICAL_MATCH_WEIGHT,
    SEARCH_VECTOR_MATCH_WEIGHT,
} from "./jobs.consts";
import type {
    JobResult,
    JobsCursor,
    JobsPageResponse,
    JobsRankingMode,
    RankedJob,
} from "./jobs.types";

const JobsCursorSchema = z.object({
    offset: z.number().int().nonnegative(),
    asOf: z.string().datetime(),
    rankingFingerprint: z.string().length(64),
});

export const encodeJobsCursor = (cursor: JobsCursor): string =>
    Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

export const decodeJobsCursor = (value: string): JobsCursor | null => {
    try {
        const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
        const result = JobsCursorSchema.safeParse(parsed);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
};

export const shouldApplyMinMatchFitFilter = (
    scoreVector: readonly number[] | null,
    rankingMode: JobsRankingMode,
    searchTerm = "",
): boolean =>
    searchTerm.trim().length > 0 &&
    scoreVector !== null &&
    scoreVector.length > 0 &&
    (rankingMode === "profile_query" || rankingMode === "query");

const tokenizeSearchTerm = (searchTerm: string): string[] =>
    searchTerm
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);

/** Keyword overlap score (0–100), with heavier weight on title hits and exact phrase matches. */
export const computeLexicalMatchPct = (job: RankedJob, searchTerm: string): number => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (trimmed.length === 0) return 0;

    const title = job.jobTitle.toLowerCase();
    const body = `${job.description} ${(job.requirements ?? []).join(" ")}`.toLowerCase();
    if (title.includes(trimmed)) return 100;
    if (body.includes(trimmed)) return 85;

    const tokens = tokenizeSearchTerm(trimmed);
    if (tokens.length === 0) return 0;

    const titleHits = tokens.filter((token) => title.includes(token)).length;
    const bodyHits = tokens.filter((token) => body.includes(token)).length;
    const titleCoverage = titleHits / tokens.length;
    const bodyCoverage = bodyHits / tokens.length;
    return Math.round(Math.min(1, titleCoverage * 0.8 + bodyCoverage * 0.2) * 100);
};

export const computeJobMatchPct = (
    job: RankedJob,
    scoreVector: readonly number[] | null,
    searchTerm = "",
): number | undefined => {
    if (!scoreVector || job.searchEmbedding.length !== scoreVector.length) {
        if (searchTerm.trim().length === 0) return undefined;
        const lexicalOnly = computeLexicalMatchPct(job, searchTerm);
        return lexicalOnly > 0 ? lexicalOnly : undefined;
    }

    const vectorPct = computeVectorMatchScore([...scoreVector], job.searchEmbedding);
    if (searchTerm.trim().length === 0) return vectorPct;

    const lexicalPct = computeLexicalMatchPct(job, searchTerm);
    return Math.round(
        vectorPct * SEARCH_VECTOR_MATCH_WEIGHT + lexicalPct * SEARCH_LEXICAL_MATCH_WEIGHT,
    );
};

export const filterRankedJobsByMinMatchFit = (
    jobs: readonly RankedJob[],
    scoreVector: readonly number[],
    searchTerm = "",
): RankedJob[] =>
    jobs.filter((job) => (computeJobMatchPct(job, scoreVector, searchTerm) ?? 0) >= JOBS_LIST_MIN_MATCH_FIT_PCT);

/** Re-rank vector candidates so title/keyword matches outrank weak semantic neighbors. */
export const rankJobsByQueryRelevance = (
    jobs: readonly RankedJob[],
    scoreVector: readonly number[],
    searchTerm: string,
): RankedJob[] =>
    [...jobs].sort((left, right) => {
        const leftScore = computeJobMatchPct(left, scoreVector, searchTerm) ?? 0;
        const rightScore = computeJobMatchPct(right, scoreVector, searchTerm) ?? 0;
        if (rightScore !== leftScore) return rightScore - leftScore;
        return left.jobTitle.localeCompare(right.jobTitle);
    });

export const sliceJobsPageWindow = (jobs: readonly RankedJob[], offset: number): RankedJob[] =>
    jobs.slice(offset, offset + JOBS_PAGE_SIZE + JOBS_PAGE_LOOKAHEAD);

export const createRankingFingerprint = (
    userId: string,
    search: string,
    profileContext: UserMatchingContext | null,
    rankingMode: JobsRankingMode,
    embeddingModel: string,
): string => {
    const profileHash = profileContext
        ? createHash("sha256").update(Buffer.from(new Float64Array(profileContext.embedding).buffer)).digest("hex")
        : "none";
    const input = [
        userId,
        search.trim().toLowerCase(),
        profileHash,
        rankingMode,
        embeddingModel,
        String(SEARCH_VECTOR_MATCH_WEIGHT),
        String(SEARCH_LEXICAL_MATCH_WEIGHT),
        search.trim().length > 0 ? `minMatch:${JOBS_LIST_MIN_MATCH_FIT_PCT}` : "minMatch:none",
        "search-relevance-v2",
    ].join("|");
    return createHash("sha256").update(input).digest("hex");
};

const toJobResult = (
    job: RankedJob,
    scoreVector: readonly number[] | null,
    searchTerm: string,
): JobResult => ({
    id: job.id,
    jobTitle: job.jobTitle,
    company: job.company,
    seniority: job.seniority,
    description: job.description,
    url: job.url,
    salary: job.salary,
    requirements: job.requirements,
    benefits: job.benefits,
    matchPct: computeJobMatchPct(job, scoreVector, searchTerm),
});

export const toJobsPageResponse = (
    rankedJobs: readonly RankedJob[],
    scoreVector: readonly number[] | null,
    rankingMode: JobsRankingMode,
    cursor: JobsCursor,
    searchTerm = "",
): JobsPageResponse => {
    const hasMore = rankedJobs.length > JOBS_PAGE_SIZE;
    const jobs = rankedJobs.slice(0, JOBS_PAGE_SIZE).map((job) => toJobResult(job, scoreVector, searchTerm));
    const nextCursor = hasMore
        ? encodeJobsCursor({ ...cursor, offset: cursor.offset + JOBS_PAGE_SIZE })
        : null;
    return {
        jobs,
        pagination: {
            pageSize: JOBS_PAGE_SIZE,
            nextCursor,
            hasMore,
        },
        rankingMode,
    };
};

export const isProfileContextCompatible = (
    context: UserMatchingContext | null,
    expectedModel: string,
    expectedDimensions: number,
): context is UserMatchingContext =>
    context !== null &&
    context.status === "ready" &&
    context.model === expectedModel &&
    context.embedding.length === expectedDimensions &&
    cosineSimilarity(context.embedding, context.embedding) > 0;
