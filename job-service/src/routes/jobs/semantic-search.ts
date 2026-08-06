import type { Collection, Filter, WithId } from "mongodb";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import { withSpan } from "../../observability/tracing";
import { cosineSimilarity } from "../jobScores/vector-score.service";
import {
  JOBS_PAGE_LOOKAHEAD,
  JOBS_PAGE_SIZE,
  MAX_VECTOR_CANDIDATES,
  MIN_VECTOR_CANDIDATES,
  VECTOR_CANDIDATE_MULTIPLIER,
} from "./jobs.consts";
import type { RankedJob } from "./jobs.types";

export const EMBEDDED_JOBS_FILTER = {
  "searchEmbedding.0": { $exists: true },
} as unknown as Filter<EnrichedJob>;

const MAX_RERANK_CANDIDATES = 10_000;

export const rankJobsByCosine = <T extends { searchEmbedding?: number[] }>(
  queryVector: number[],
  jobs: readonly T[],
  limit: number,
  minSimilarity = 0
): T[] => {
  if (queryVector.length === 0 || limit <= 0) return [];

  return jobs
    .filter(
      (job): job is T & { searchEmbedding: number[] } =>
        Array.isArray(job.searchEmbedding) &&
        job.searchEmbedding.length === queryVector.length
    )
    .map((job) => ({ job, score: cosineSimilarity(queryVector, job.searchEmbedding) }))
    .filter((scored) => scored.score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((scored) => scored.job);
};

export const semanticSearchJobs = async (
  collection: Collection<EnrichedJob>,
  queryVector: number[],
  limit: number
): Promise<EnrichedJob[]> => {
  if (queryVector.length === 0 || limit <= 0) return [];

  const candidates = await collection
    .find(EMBEDDED_JOBS_FILTER, { projection: { _id: 0, id: 1, searchEmbedding: 1 } })
    .limit(MAX_RERANK_CANDIDATES)
    .toArray();
  if (candidates.length === 0) return [];
  if (candidates.length === MAX_RERANK_CANDIDATES) {
    console.warn(
      `semanticSearchJobs: candidate set hit the ${MAX_RERANK_CANDIDATES} cap; some jobs were not ranked`
    );
  }

  const topIds = rankJobsByCosine(queryVector, candidates, limit).map((job) => job.id);
  if (topIds.length === 0) return [];

  const docs = await collection.find({ id: { $in: topIds } }).toArray();
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  return topIds
    .map((id) => byId.get(id))
    .filter((doc): doc is WithId<EnrichedJob> => doc !== undefined);
};

export const vectorSearchJobsPage = async (
  collection: Collection<EnrichedJob>,
  queryVector: readonly number[],
  offset: number,
  asOf: Date,
  indexName: string,
): Promise<RankedJob[]> => {
  const requestedResults = Math.min(
    MAX_VECTOR_CANDIDATES,
    offset + JOBS_PAGE_SIZE + JOBS_PAGE_LOOKAHEAD,
  );
  if (queryVector.length === 0 || offset >= MAX_VECTOR_CANDIDATES) return [];

  const numCandidates = Math.min(
    MAX_VECTOR_CANDIDATES,
    Math.max(MIN_VECTOR_CANDIDATES, requestedResults * VECTOR_CANDIDATE_MULTIPLIER),
  );
  const pipeline = [
    {
      $vectorSearch: {
        index: indexName,
        path: "searchEmbedding",
        queryVector: [...queryVector],
        numCandidates,
        limit: requestedResults,
        filter: { createdAt: { $lte: asOf } },
      },
    },
    { $skip: offset },
    { $limit: JOBS_PAGE_SIZE + JOBS_PAGE_LOOKAHEAD },
    {
      $project: {
        _id: 0,
        id: 1,
        jobTitle: 1,
        company: 1,
        seniority: 1,
        description: 1,
        url: 1,
        salary: 1,
        requirements: 1,
        benefits: 1,
        searchEmbedding: 1,
        createdAt: 1,
        vectorScore: { $meta: "vectorSearchScore" },
      },
    },
  ];
  return withSpan("jobs.vector_search", {
    "jobs.pagination.offset": offset,
    "jobs.pagination.page_size": JOBS_PAGE_SIZE,
    "jobs.vector.num_candidates": numCandidates,
    "jobs.vector.index": indexName,
  }, async (span) => {
    const jobs = await collection.aggregate<RankedJob>(pipeline).toArray();
    span.setAttribute("jobs.results.count", jobs.length);
    return jobs;
  });
};
