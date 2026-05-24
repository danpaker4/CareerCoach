import type { Collection } from "mongodb";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { SkillMatcher } from "../skillMatcher/skill-matcher.model";
import type { LlmTokenUsageDocument } from "../../llm-token-usage/llm-token-usage.types";
import type { UserEmbeddingCache } from "../../cache/user-embedding.cache";
import { LlmTokenUsageRepository } from "../../llm-token-usage/llm-token-usage.repository";
import { JobsHandler } from "./jobs.handler";
import { createJobSchema } from "./jobs.schema";

export const jobsRouter = (
  jobsCollection: Collection<EnrichedJob>,
  skillMatchersCollection: Collection<SkillMatcher>,
  tokenUsageCollection: Collection<LlmTokenUsageDocument>,
  embeddingCache: UserEmbeddingCache
) => async (fastify: FastifyInstance) => {
  const tokenUsageRecorder = new LlmTokenUsageRepository(tokenUsageCollection);
  const usersServiceBaseUrl = process.env.USERS_SERVICE_BASE_URL;
  const handler = JobsHandler(jobsCollection, skillMatchersCollection, tokenUsageRecorder, usersServiceBaseUrl, embeddingCache);

  fastify.get("/jobs", handler.getJobsHandler);
  fastify.withTypeProvider<ZodTypeProvider>().post("/jobs", { schema: createJobSchema }, handler.createJobHandler);
};
