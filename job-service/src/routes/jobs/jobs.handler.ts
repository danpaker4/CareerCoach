import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { SkillMatcher } from "../skillMatcher/skill-matcher.model";
import { createEmbeddingClient, createEmbedding, type EmbeddingClient } from "../../poller/job-poller-api-stack/stages/enrich/embedding";

type GetJobsQuery = { search?: string; userId?: string };

const VECTOR_INDEX_NAME = process.env.JOB_VECTOR_INDEX_NAME || "jobs_vector_index";
const VECTOR_SEARCH_LIMIT = 30;
const VECTOR_NUM_CANDIDATES = 150;

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const getEmbeddingClient = (): EmbeddingClient | null => {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? createEmbeddingClient(apiKey) : null;
};

const projectFields = {
  _id: 0,
  id: 1,
  jobTitle: 1,
  company: 1,
  seniority: 1,
  description: 1,
  url: 1,
  salary: 1,
  requirements: 1,
  benefits: 1,
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

      const skillsPromise = userId
        ? skillMatchersCollection.find({ userId }).toArray()
        : Promise.resolve([]);

      let jobs: EnrichedJob[];

      if (search && search.trim()) {
        const term = search.trim();
        const embeddingClient = getEmbeddingClient();

        if (embeddingClient) {
          try {
            const queryVector = await createEmbedding(embeddingClient, term);
            jobs = await jobsCollection.aggregate([
              {
                $vectorSearch: {
                  index: VECTOR_INDEX_NAME,
                  path: "searchEmbedding",
                  queryVector,
                  numCandidates: VECTOR_NUM_CANDIDATES,
                  limit: VECTOR_SEARCH_LIMIT,
                },
              },
              { $project: projectFields },
            ]).toArray() as unknown as EnrichedJob[];
          } catch (error) {
            request.log.warn({ error }, "Vector search failed, falling back to regex");
            jobs = await jobsCollection
              .find({
                $or: [
                  { jobTitle: { $regex: escapeRegex(term), $options: "i" } },
                  { company: { $regex: escapeRegex(term), $options: "i" } },
                  { description: { $regex: escapeRegex(term), $options: "i" } },
                ],
              }, { projection: projectFields })
              .limit(50)
              .toArray();
          }
        } else {
          jobs = await jobsCollection
            .find({
              $or: [
                { jobTitle: { $regex: escapeRegex(term), $options: "i" } },
                { company: { $regex: escapeRegex(term), $options: "i" } },
                { description: { $regex: escapeRegex(term), $options: "i" } },
              ],
            }, { projection: projectFields })
            .limit(50)
            .toArray();
        }
      } else {
        jobs = await jobsCollection.find({}, { projection: projectFields }).limit(50).toArray();
      }

      const matchers = await skillsPromise;
      const userSkills = matchers.flatMap((m) => m.skillToImprove.map((s) => s.skill));

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

      if (userId) {
        result.sort((a, b) => (b.matchPct ?? 0) - (a.matchPct ?? 0));
      }

      reply.code(StatusCodes.OK).send(result);
    } catch (error) {
      request.log.error({ error }, "Job search failed");
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error" });
    }
  },
});
