import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
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

const VECTOR_INDEX_NAME = process.env.JOB_VECTOR_INDEX_NAME || "jobs_vector_index";
const NUM_CANDIDATES = 150;
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

const vectorSearch = async (
  collection: Collection<EnrichedJob>,
  queryVector: number[]
): Promise<EnrichedJob[]> =>
  collection
    .aggregate<EnrichedJob>([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "searchEmbedding",
          queryVector,
          numCandidates: NUM_CANDIDATES,
          limit: SEARCH_LIMIT,
        },
      },
    ])
    .toArray();

const vectorSearchWithFallback = async (
  collection: Collection<EnrichedJob>,
  term: string
): Promise<EnrichedJob[]> => {
  try {
    const queryVector = await generateQueryVector(term);

    if (queryVector) {
      const results = await vectorSearch(collection, queryVector);
      if (results.length > 0) return results;
    }
  } catch {
    // Fall through to regex search when vector search cannot be used.
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
      const jobs = term
        ? await vectorSearchWithFallback(jobsCollection, term)
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
      const sortedResult = userEmbedding
        ? [...result].sort((a, b) => (b.matchPct ?? 0) - (a.matchPct ?? 0))
        : result;

      reply.code(StatusCodes.OK).send(sortedResult);
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
