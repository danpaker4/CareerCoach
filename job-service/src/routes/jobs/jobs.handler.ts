import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import { getJobEmbeddingConfig } from "../../ai/job-embedding.config";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { AdaptedJob } from "../../poller/job-poller-api-stack/stages/adapt/adapt-resource.types";
import type { LlmTokenUsageRecorder } from "../../llm-token-usage/llm-token-usage.types";
import { generateQueryVector } from "../../ai/embedding.utils";
import type { UserEmbeddingCache, UserMatchingContext } from "../../cache/user-embedding.cache";
import { enrichByGemini } from "../../poller/job-poller-api-stack/stages/enrich/enrich-by-gemini";
import { saveEnrichedJobs } from "../../poller/job-poller-api-stack/stages/save/save-enriched-jobs";
import { fetchUserMatchingContext } from "./user-profile.client";
import type { CreateJobBody } from "./jobs.schema";
import { JOBS_PAGE_LOOKAHEAD, JOBS_PAGE_SIZE, HIGH_MATCH_OVERFETCH_MULTIPLIER, MAX_VECTOR_CANDIDATES, MIN_VECTOR_CANDIDATES } from "./jobs.consts";
import { vectorSearchJobsPage } from "./semantic-search";
import type {
  JobsCursor,
  JobsPageQuery,
  JobsRankingMode,
  JobsRankingStrategy,
  RankedJob,
} from "./jobs.types";
import {
  blendSearchAndProfileVectors,
  createRankingFingerprint,
  decodeJobsCursor,
  filterRankedJobsByMinMatchFit,
  isProfileContextCompatible,
  shouldApplyMinMatchFitFilter,
  sliceJobsPageWindow,
  toJobsPageResponse,
} from "./jobs.utils";

interface JobsHandlerDeps {
  jobsCollection: Collection<EnrichedJob>;
  tokenUsageRecorder?: LlmTokenUsageRecorder;
  usersServiceBaseUrl?: string;
  internalServiceApiKey?: string;
  embeddingCache?: UserEmbeddingCache;
  onJobCreated?: (job: EnrichedJob) => Promise<void>;
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const fallbackSearch = async (
  collection: Collection<EnrichedJob>,
  term: string,
  offset: number,
  asOf: Date,
): Promise<RankedJob[]> => {
  const searchFilter = term
    ? {
        $or: [
          { jobTitle: { $regex: escapeRegex(term), $options: "i" } },
          { company: { $regex: escapeRegex(term), $options: "i" } },
          { description: { $regex: escapeRegex(term), $options: "i" } },
        ],
      }
    : {};
  return collection
    .find({
      ...searchFilter,
      createdAt: { $lte: asOf },
    })
    .sort({ createdAt: -1, id: 1 })
    .skip(offset)
    .limit(JOBS_PAGE_SIZE + JOBS_PAGE_LOOKAHEAD)
    .toArray();
};

const resolveRankingStrategy = async (
  term: string,
  profileContext: UserMatchingContext | null,
  vectorSearchEnabled: boolean,
  request: FastifyRequest,
): Promise<JobsRankingStrategy> => {
  if (!vectorSearchEnabled) {
    return { vector: null, mode: term ? "keyword" : "recent" };
  }

  if (!term) {
    return profileContext
      ? { vector: profileContext.embedding, mode: "profile" }
      : { vector: null, mode: "recent" };
  }

  try {
    const searchVector = await generateQueryVector(term);
    if (!searchVector) return { vector: null, mode: "keyword" };
    if (!profileContext) return { vector: searchVector, mode: "query" };
    const blendedVector = blendSearchAndProfileVectors(searchVector, profileContext.embedding);
    return blendedVector.length > 0
      ? { vector: blendedVector, mode: "profile_query" }
      : { vector: searchVector, mode: "query" };
  } catch (error) {
    request.log.warn({ err: error }, "Query embedding failed; falling back to keyword search");
    return { vector: null, mode: "keyword" };
  }
};

const getUserMatchingContext = async (
  userId: string,
  embeddingCache: UserEmbeddingCache | undefined,
  usersServiceBaseUrl: string | undefined,
  internalServiceApiKey: string | undefined,
): Promise<UserMatchingContext | null> => {
  if (!embeddingCache) {
    return null;
  }

  const cachedContext = embeddingCache.get(userId);
  if (cachedContext) {
    return cachedContext;
  }

  if (!usersServiceBaseUrl || !internalServiceApiKey) {
    return null;
  }

  const fetchedContext = await fetchUserMatchingContext(usersServiceBaseUrl, userId, internalServiceApiKey);
  if (fetchedContext) {
    embeddingCache.set(userId, fetchedContext);
  }

  return fetchedContext;
};

const getFallbackMode = (term: string): JobsRankingMode => term ? "keyword" : "recent";

export const JobsHandler = ({
  jobsCollection,
  tokenUsageRecorder,
  usersServiceBaseUrl,
  internalServiceApiKey,
  embeddingCache,
  onJobCreated,
}: JobsHandlerDeps) => ({
  getJobsHandler: async (
    request: FastifyRequest<{ Querystring: JobsPageQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { search, userId } = request.query;
      const term = search?.trim() ?? "";
      const config = getJobEmbeddingConfig();
      const fetchedProfileContext = await getUserMatchingContext(
        userId,
        embeddingCache,
        usersServiceBaseUrl,
        internalServiceApiKey,
      );
      const profileContext = isProfileContextCompatible(
        fetchedProfileContext,
        config.JOB_EMBEDDING_MODEL,
        config.JOB_EMBEDDING_DIMENSIONS,
      )
        ? fetchedProfileContext
        : null;
      const strategy = await resolveRankingStrategy(
        term,
        profileContext,
        config.JOBS_VECTOR_SEARCH_ENABLED,
        request,
      );
      const decodedCursor = request.query.cursor ? decodeJobsCursor(request.query.cursor) : null;
      if (request.query.cursor && !decodedCursor) {
        reply.code(StatusCodes.BAD_REQUEST).send({ error: "INVALID_CURSOR" });
        return;
      }

      const asOf = decodedCursor ? new Date(decodedCursor.asOf) : new Date();
      const offset = decodedCursor?.offset ?? 0;
      const rankingFingerprint = createRankingFingerprint(
        userId,
        term,
        profileContext,
        strategy.mode,
        config.JOB_EMBEDDING_MODEL,
      );
      if (decodedCursor && decodedCursor.rankingFingerprint !== rankingFingerprint) {
        reply.code(StatusCodes.CONFLICT).send({ error: "STALE_CURSOR" });
        return;
      }

      const cursor: JobsCursor = {
        offset,
        asOf: asOf.toISOString(),
        rankingFingerprint,
      };
      if (!strategy.vector) {
        const jobs = await fallbackSearch(jobsCollection, term, offset, asOf);
        reply.code(StatusCodes.OK).send(toJobsPageResponse(jobs, profileContext, strategy.mode, cursor));
        return;
      }

      try {
        const applyMinMatchFilter = shouldApplyMinMatchFitFilter(profileContext, strategy.mode);
        if (applyMinMatchFilter && profileContext) {
          const candidateLimit = Math.min(
            MAX_VECTOR_CANDIDATES,
            Math.max(
              MIN_VECTOR_CANDIDATES,
              (offset + JOBS_PAGE_SIZE + JOBS_PAGE_LOOKAHEAD) * HIGH_MATCH_OVERFETCH_MULTIPLIER,
            ),
          );
          const candidates = await vectorSearchJobsPage(
            jobsCollection,
            strategy.vector,
            0,
            asOf,
            config.JOB_VECTOR_INDEX_NAME,
            { candidateLimit },
          );
          const highMatchJobs = filterRankedJobsByMinMatchFit(candidates, profileContext);
          const jobs = sliceJobsPageWindow(highMatchJobs, offset);
          reply.code(StatusCodes.OK).send(toJobsPageResponse(jobs, profileContext, strategy.mode, cursor));
          return;
        }

        const jobs = await vectorSearchJobsPage(
          jobsCollection,
          strategy.vector,
          offset,
          asOf,
          config.JOB_VECTOR_INDEX_NAME,
        );
        reply.code(StatusCodes.OK).send(toJobsPageResponse(jobs, profileContext, strategy.mode, cursor));
      } catch (error) {
        request.log.warn({ err: error }, "Vector search failed; using deterministic fallback");
        if (decodedCursor) {
          reply.code(StatusCodes.CONFLICT).send({ error: "STALE_CURSOR" });
          return;
        }
        const fallbackMode = getFallbackMode(term);
        const fallbackFingerprint = createRankingFingerprint(
          userId,
          term,
          profileContext,
          fallbackMode,
          config.JOB_EMBEDDING_MODEL,
        );
        const jobs = await fallbackSearch(jobsCollection, term, 0, asOf);
        reply.code(StatusCodes.OK).send(toJobsPageResponse(
          jobs,
          profileContext,
          fallbackMode,
          { ...cursor, rankingFingerprint: fallbackFingerprint },
        ));
      }
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
      const { jobTitle, company, url, description, seniority, salary, location, requirements } = request.body;

      const adapted: AdaptedJob = {
        id: randomUUID(),
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        url: url ? url.trim() : "",
        seniority: seniority.trim(),
        description: description.trim(),
        ...(location && location.trim().length > 0 ? { location: location.trim() } : {}),
        lon: null,
        lat: null,
      };

      const [enriched] = await enrichByGemini([adapted], tokenUsageRecorder);
      // Caller-supplied requirements take precedence over the model-inferred ones.
      const providedRequirements = (requirements ?? [])
        .map((req) => req.trim())
        .filter((req) => req.length > 0);
      const finalJob: EnrichedJob = {
        ...enriched,
        ...(salary !== undefined && salary > 0 ? { salary } : {}),
        ...(providedRequirements.length > 0 ? { requirements: providedRequirements } : {}),
      };

      await saveEnrichedJobs(jobsCollection, [finalJob]);

      if (onJobCreated) {
        void onJobCreated(finalJob).catch((err) => {
          request.log.warn({ err }, "onJobCreated dispatch failed");
        });
      }

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
