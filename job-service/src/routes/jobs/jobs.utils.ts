import { createHash } from "node:crypto";
import { z } from "zod";
import type { UserMatchingContext } from "../../cache/user-embedding.cache";
import { cosineSimilarity, computeVectorMatchScore } from "../jobScores/vector-score.service";
import {
    JOBS_PAGE_LOOKAHEAD,
    JOBS_PAGE_SIZE,
    MIN_MATCH_FIT_PCT,
    PROFILE_QUERY_WEIGHT,
    SEARCH_QUERY_WEIGHT,
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

const normalizeVector = (vector: readonly number[]): number[] => {
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return magnitude === 0 ? [] : vector.map((value) => value / magnitude);
};

export const blendSearchAndProfileVectors = (
    searchVector: readonly number[],
    profileVector: readonly number[],
): number[] => {
    if (searchVector.length === 0 || searchVector.length !== profileVector.length) return [];
    const normalizedSearch = normalizeVector(searchVector);
    const normalizedProfile = normalizeVector(profileVector);
    if (normalizedSearch.length === 0 || normalizedProfile.length === 0) return [];

    return normalizeVector(
        normalizedSearch.map(
            (value, index) => value * SEARCH_QUERY_WEIGHT + normalizedProfile[index] * PROFILE_QUERY_WEIGHT,
        ),
    );
};

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
    profileContext: UserMatchingContext | null,
    rankingMode: JobsRankingMode,
): boolean =>
    profileContext !== null &&
    (rankingMode === "profile" || rankingMode === "profile_query");

export const filterRankedJobsByMinMatchFit = (
    jobs: readonly RankedJob[],
    profileContext: UserMatchingContext,
): RankedJob[] =>
    jobs.filter((job) => {
        if (job.searchEmbedding.length !== profileContext.embedding.length) return false;
        return computeVectorMatchScore(profileContext.embedding, job.searchEmbedding) >= MIN_MATCH_FIT_PCT;
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
        String(SEARCH_QUERY_WEIGHT),
        String(PROFILE_QUERY_WEIGHT),
        shouldApplyMinMatchFitFilter(profileContext, rankingMode)
            ? `minMatch:${MIN_MATCH_FIT_PCT}`
            : "minMatch:none",
    ].join("|");
    return createHash("sha256").update(input).digest("hex");
};

const toJobResult = (job: RankedJob, profileContext: UserMatchingContext | null): JobResult => ({
    id: job.id,
    jobTitle: job.jobTitle,
    company: job.company,
    seniority: job.seniority,
    description: job.description,
    url: job.url,
    salary: job.salary,
    requirements: job.requirements,
    benefits: job.benefits,
    matchPct:
        profileContext && job.searchEmbedding.length === profileContext.embedding.length
            ? computeVectorMatchScore(profileContext.embedding, job.searchEmbedding)
            : undefined,
});

export const toJobsPageResponse = (
    rankedJobs: readonly RankedJob[],
    profileContext: UserMatchingContext | null,
    rankingMode: JobsRankingMode,
    cursor: JobsCursor,
): JobsPageResponse => {
    const hasMore = rankedJobs.length > JOBS_PAGE_SIZE;
    const jobs = rankedJobs.slice(0, JOBS_PAGE_SIZE).map((job) => toJobResult(job, profileContext));
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
