import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { AdaptedJob } from "../../poller/job-poller-api-stack/stages/adapt/adapt-resource.types";
import type { LlmTokenUsageRecorder } from "../../llm-token-usage/llm-token-usage.types";
import { generateQueryVector } from "../../ai/embedding.utils";
import type { UserEmbeddingCache } from "../../cache/user-embedding.cache";
import { computeVectorMatchScore } from "../jobScores/vector-score.service";
import { enrichByGemini } from "../../poller/job-poller-api-stack/stages/enrich/enrich-by-gemini";
import { saveEnrichedJobs } from "../../poller/job-poller-api-stack/stages/save/save-enriched-jobs";
import { fetchUserProfileEmbedding } from "./user-profile.client";
import type { CreateJobBody } from "./jobs.schema";
import { MIN_MATCH_FIT_PCT } from "./jobs.consts";
import { semanticSearchJobs } from "./semantic-search";

const SEARCH_LIMIT = 50;

type GetJobsQuery = { search?: string; userId?: string };

interface JobsHandlerDeps {
  jobsCollection: Collection<EnrichedJob>;
  tokenUsageRecorder?: LlmTokenUsageRecorder;
  usersServiceBaseUrl?: string;
  embeddingCache?: UserEmbeddingCache;
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Keyword fallback, used only when semantic search is unavailable (no embedding
// model configured, or no jobs have embeddings yet).
const regexSearch = async (
  collection: Collection<EnrichedJob>,
  term: string
): Promise<EnrichedJob[]> => {
  const escaped = escapeRegex(term);
  return collection
    .find({
      $or: [
        { jobTitle: { $regex: escaped, $options: "i" } },
        { company: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
      ],
    })
    .limit(SEARCH_LIMIT)
    .toArray();
};

// Real, in-app vector search: embed the query, then rank embedded jobs by
// cosine similarity. Returns null when no embedding model is configured, so the
// caller can fall back to keyword search. No Atlas / $vectorSearch index needed.
const semanticSearch = async (
  collection: Collection<EnrichedJob>,
  term: string
): Promise<EnrichedJob[] | null> => {
  const queryVector = await generateQueryVector(term);
  if (!queryVector) return null;

  return semanticSearchJobs(collection, queryVector, SEARCH_LIMIT);
};

const searchJobs = async (
  collection: Collection<EnrichedJob>,
  term: string,
  logger?: FastifyBaseLogger
): Promise<EnrichedJob[]> => {
  try {
    const semantic = await semanticSearch(collection, term);
    if (semantic && semantic.length > 0) return semantic;
  } catch (error) {
    // Genuine faults (bad API key, Mongo errors) shouldn't silently masquerade
    // as keyword results — log before degrading so misconfiguration is visible.
    logger?.warn({ err: error }, "Semantic search failed; falling back to keyword search");
  }

  return regexSearch(collection, term);
};

const getUserEmbedding = async (
  userId: string | undefined,
  embeddingCache: UserEmbeddingCache | undefined,
  usersServiceBaseUrl: string | undefined
): Promise<number[] | null> => {
  if (!userId || !embeddingCache) {
    return null;
  }

  const cachedEmbedding = embeddingCache.get(userId);
  if (cachedEmbedding) {
    return cachedEmbedding;
  }

  if (!usersServiceBaseUrl) {
    return null;
  }

  const fetchedEmbedding = await fetchUserProfileEmbedding(usersServiceBaseUrl, userId);
  if (fetchedEmbedding) {
    embeddingCache.set(userId, fetchedEmbedding);
  }

  return fetchedEmbedding;
};

const getMatchPct = (userEmbedding: number[] | null, jobEmbedding: number[]): number | undefined =>
  userEmbedding && jobEmbedding.length > 0
    ? computeVectorMatchScore(userEmbedding, jobEmbedding)
    : undefined;

export const JobsHandler = ({
  jobsCollection,
  tokenUsageRecorder,
  usersServiceBaseUrl,
  embeddingCache,
}: JobsHandlerDeps) => ({
  getJobsHandler: async (
    request: FastifyRequest<{ Querystring: GetJobsQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { search, userId } = request.query;
      const term = search?.trim();
      const isBrowse = !term;
      const jobs = term
        ? await searchJobs(jobsCollection, term, request.log)
        : await jobsCollection.find({}).limit(SEARCH_LIMIT).toArray();
      const userEmbedding = await getUserEmbedding(userId, embeddingCache, usersServiceBaseUrl);
      const result = jobs.map((job) => ({
        id: job.id,
        jobTitle: job.jobTitle,
        company: job.company,
        seniority: job.seniority,
        description: job.description,
        url: job.url,
        salary: job.salary,
        requirements: job.requirements,
        benefits: job.benefits,
        matchPct: getMatchPct(userEmbedding, job.searchEmbedding),
      }));
      // When the user is browsing (no query), order and filter by profile fit.
      // When they typed a query, honor the search: keep the cosine relevance
      // order and don't hide jobs just because they aren't an 80% profile match
      // (matchPct stays on each result as informational metadata).
      const sortedResult = userEmbedding && isBrowse
        ? [...result].sort((a, b) => (b.matchPct ?? 0) - (a.matchPct ?? 0))
        : result;
      const filteredResult = userEmbedding && isBrowse
        ? sortedResult.filter((job) => (job.matchPct ?? 0) >= MIN_MATCH_FIT_PCT)
        : sortedResult;

      reply.code(StatusCodes.OK).send(filteredResult);
    } catch (error) {
      request.log.error({ err: error }, "Failed to fetch jobs");
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  createJobHandler: async (
    request: FastifyRequest<{ Body: CreateJobBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { jobTitle, company, url, description, seniority, salary } = request.body;

      const adapted: AdaptedJob = {
        id: randomUUID(),
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        url: url ? url.trim() : "",
        seniority: seniority.trim(),
        description: description.trim(),
        lon: null,
        lat: null,
      };

      const [enriched] = await enrichByGemini([adapted], tokenUsageRecorder);
      const finalJob: EnrichedJob = salary !== undefined && salary > 0
        ? { ...enriched, salary }
        : enriched;

      await saveEnrichedJobs(jobsCollection, [finalJob]);

      reply.code(StatusCodes.CREATED).send({
        id: finalJob.id,
        jobTitle: finalJob.jobTitle,
        company: finalJob.company,
        seniority: finalJob.seniority,
        description: finalJob.description,
        url: finalJob.url,
        salary: finalJob.salary,
        requirements: finalJob.requirements,
        benefits: finalJob.benefits,
      });
    } catch (error) {
      request.log.error({ err: error }, "Failed to create job");
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
        message: "Failed to create job",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
