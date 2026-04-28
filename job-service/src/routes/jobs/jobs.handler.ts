import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { SkillMatcher } from "../skillMatcher/skill-matcher.model";

type GetJobsQuery = { search?: string; userId?: string };

const computeMatchPct = (
  requirements: string[] | undefined,
  userSkills: string[]
): number => {
  if (!requirements || requirements.length === 0) return 0;
  const lower = userSkills.map((s) => s.toLowerCase());
  const matched = requirements.filter((req) =>
    lower.some((skill) => req.toLowerCase().includes(skill) || skill.includes(req.toLowerCase()))
  ).length;
  return Math.round((matched / requirements.length) * 100);
};

export const JobsHandler = (
  jobsCollection: Collection<EnrichedJob>,
  skillMatchersCollection: Collection<SkillMatcher>
) => ({
  getJobsHandler: async (
    request: FastifyRequest<{ Querystring: GetJobsQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { search, userId } = request.query;

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

      let userSkills: string[] = [];
      if (userId) {
        const matchers = await skillMatchersCollection.find({ userId }).toArray();
        userSkills = matchers.flatMap((m) => m.skillToImprove.map((s) => s.skill));
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
        matchPct: userId ? computeMatchPct(job.requirements, userSkills) : undefined,
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
