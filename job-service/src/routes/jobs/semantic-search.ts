import type { Collection, Filter, WithId } from "mongodb";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import { cosineSimilarity } from "../jobScores/vector-score.service";

// Only jobs with a non-empty embedding can take part in semantic search.
export const EMBEDDED_JOBS_FILTER = {
  "searchEmbedding.0": { $exists: true },
} as unknown as Filter<EnrichedJob>;

// Safety backstop on how many embedded jobs we pull in to rerank.
const MAX_RERANK_CANDIDATES = 10_000;

/**
 * Rank items by cosine similarity between the query embedding and each item's
 * pre-computed `searchEmbedding`, most relevant first.
 *
 * This is real, in-app vector search (no Atlas `$vectorSearch` required): the
 * query is embedded by the LLM, then compared against the stored embeddings. It
 * infers semantic intent — e.g. "pm" surfaces "Product Manager" roles — with no
 * hand-maintained synonym list.
 *
 * Items whose embedding dimensionality differs from the query (e.g. produced by
 * a different model) are skipped, since cross-model cosine is meaningless.
 * `minSimilarity` lets callers drop weak matches; the default of 0 keeps every
 * item and relies purely on ordering.
 */
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

/**
 * DB-backed semantic search shared by both search routes. Fetches only the id +
 * embedding of candidate jobs (cheap), ranks them by cosine similarity, then
 * hydrates the full documents for just the top `limit` results — preserving the
 * relevance order. Returns [] when no jobs have embeddings yet.
 */
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
