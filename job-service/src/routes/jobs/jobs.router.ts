import type { Collection } from "mongodb";
import type { FastifyInstance } from "fastify";
import type { EnrichedJob } from "../../poller/job-poller/stages/enrich/types";
import type { SkillMatcher } from "../skillMatcher/skill-matcher.model";
import { JobsHandler } from "./jobs.handler";

export const jobsRouter = (
  jobsCollection: Collection<EnrichedJob>,
  skillMatchersCollection: Collection<SkillMatcher>
) => async (fastify: FastifyInstance) => {
  const handler = JobsHandler(jobsCollection, skillMatchersCollection);
  fastify.get("/jobs", handler.getJobsHandler);
};
