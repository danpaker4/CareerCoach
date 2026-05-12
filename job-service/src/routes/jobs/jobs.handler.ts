import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { SkillMatcher } from "../skillMatcher/skill-matcher.model";
import { computeJobScore } from "../jobScores/job-score.service";

type GetJobsQuery = { search?: string; userId?: string; skills?: string };

export const JobsHandler = (
  jobsCollection: Collection<EnrichedJob>,
  skillMatchersCollection: Collection<SkillMatcher>
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

      // Sort by match % descending when userId provided
      if (userId) {
        result.sort((a, b) => (b.matchPct ?? 0) - (a.matchPct ?? 0));
      }

      reply.code(StatusCodes.OK).send(result);
    } catch (error) {
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error" });
    }
  },
});
