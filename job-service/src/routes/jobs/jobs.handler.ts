import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { AdaptedJob } from "../../poller/job-poller-api-stack/stages/adapt/adapt-resource.types";
import type { LlmTokenUsageRecorder } from "../../llm-token-usage/llm-token-usage.types";
import { generateQueryVector } from "../../ai/embedding.utils";
import { enrichByGemini } from "../../poller/job-poller-api-stack/stages/enrich/enrich-by-gemini";
import { saveEnrichedJobs } from "../../poller/job-poller-api-stack/stages/save/save-enriched-jobs";
import type { CreateJobBody } from "./jobs.schema";

const VECTOR_INDEX_NAME = process.env.JOB_VECTOR_INDEX_NAME || "jobs_vector_index";
const NUM_CANDIDATES = 150;
const SEARCH_LIMIT = 50;

type GetJobsQuery = { search?: string; userId?: string };

type MongoSearchError = {
  code?: number;
  codeName?: string;
};

interface JobsHandlerDeps {
  jobsCollection: Collection<EnrichedJob>;
  tokenUsageRecorder?: LlmTokenUsageRecorder;
}

const regexSearch = async (
  collection: Collection<EnrichedJob>,
  term: string
): Promise<EnrichedJob[]> => {
  return collection
    .find({
      $or: [
        { jobTitle: { $regex: term, $options: "i" } },
        { company: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
      ],
    })
    .limit(SEARCH_LIMIT)
    .toArray();
};

const vectorSearch = async (
  collection: Collection<EnrichedJob>,
  queryVector: number[]
): Promise<EnrichedJob[]> => {
  const results = await collection
    .aggregate([
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
  return results as EnrichedJob[];
};

/**
 * Try vector search first; fall back to regex on any failure.
 * Gracefully degrades when: API key missing, embedding fails,
 * vector index absent, or vector returns no results.
 */
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
  } catch (error) {
    const mongoErr = error as MongoSearchError;
    const isSearchNotEnabled =
      mongoErr.code === 31082 || mongoErr.codeName === "SearchNotEnabled";
    if (!isSearchNotEnabled && (error as { status?: number }).status !== 429) {
      throw error;
    }
  }

  return regexSearch(collection, term);
};

export const JobsHandler = ({
  jobsCollection,
  tokenUsageRecorder,
}: JobsHandlerDeps) => ({
  getJobsHandler: async (
    request: FastifyRequest<{ Querystring: GetJobsQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { search, userId } = request.query;
      const term = search?.trim();

      let jobs: EnrichedJob[];

      if (term) {
        jobs = await vectorSearchWithFallback(jobsCollection, term);
      } else {
        jobs = await jobsCollection.find({}).limit(SEARCH_LIMIT).toArray();
      }

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
      }));

      reply.code(StatusCodes.OK).send(result);
    } catch (error) {
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error" });
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
