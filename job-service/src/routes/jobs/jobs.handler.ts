import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { AdaptedJob } from "../../poller/job-poller-api-stack/stages/adapt/adapt-resource.types";
import type { SkillMatcher } from "../skillMatcher/skill-matcher.model";
import type { LlmTokenUsageRecorder } from "../../llm-token-usage/llm-token-usage.types";
import { computeJobScore } from "../jobScores/job-score.service";
import { enrichByGemini } from "../../poller/job-poller-api-stack/stages/enrich/enrich-by-gemini";
import { saveEnrichedJobs } from "../../poller/job-poller-api-stack/stages/save/save-enriched-jobs";
import type { CreateJobBody } from "./jobs.schema";

type GetJobsQuery = { search?: string; userId?: string; skills?: string };

export const JobsHandler = (
  jobsCollection: Collection<EnrichedJob>,
  skillMatchersCollection: Collection<SkillMatcher>,
  tokenUsageRecorder?: LlmTokenUsageRecorder
) => ({
  getJobsHandler: async (
    request: FastifyRequest<{ Querystring: GetJobsQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { search, userId, skills } = request.query;

      const filter: Record<string, unknown> = {};
      if (search && search.trim()) {
        const term = search.trim();
        filter.$or = [
          { jobTitle: { $regex: term, $options: "i" } },
          { company: { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
        ];
      }

      const jobs = await jobsCollection.find(filter).limit(50).toArray();

      let allSkills: string[] = [];
      if (userId) {
        const matchers = await skillMatchersCollection.find({ userId }).toArray();
        const matcherSkills = matchers.flatMap((m) => m.skillToImprove.map((s) => s.skill));
        const profileSkills = skills ? skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
        allSkills = [...new Set([...matcherSkills, ...profileSkills])];
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
        matchPct: userId && allSkills.length > 0
          ? computeJobScore(job, allSkills).overallScore
          : undefined,
      }));

      if (userId) {
        result.sort((a, b) => (b.matchPct ?? 0) - (a.matchPct ?? 0));
      }

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
