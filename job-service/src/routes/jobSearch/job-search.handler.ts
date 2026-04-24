import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller/stages/enrich/types";
import type { JobSearchRequest, JobSearchResponseItem } from "./job-search.types";

const isJobSearchRequest = (body: unknown): body is JobSearchRequest => {
    if (typeof body !== "object" || body === null) {
        return false;
    }

    const payload = body as Record<string, unknown>;
    return (
        Array.isArray(payload.skills) &&
        Array.isArray(payload.interests) &&
        typeof payload.experienceLevel === "string" &&
        Array.isArray(payload.keywords)
    );
};

const normalize = (items: readonly string[]): string[] => items.map((item) => item.toLowerCase().trim()).filter(Boolean);

const scoreJob = (job: EnrichedJob, request: JobSearchRequest): number => {
    const haystack = `${job.jobTitle} ${job.description} ${job.seniority}`.toLowerCase();
    const signals = [...normalize(request.skills), ...normalize(request.interests), ...normalize(request.keywords)];
    const signalScore = signals.reduce((total, signal) => total + (haystack.includes(signal) ? 1 : 0), 0);
    const experienceScore = request.experienceLevel
        ? (job.seniority.toLowerCase().includes(request.experienceLevel.toLowerCase()) ? 2 : 0)
        : 0;
    return signalScore + experienceScore;
};

const toJobSearchResponseItem = (job: EnrichedJob): JobSearchResponseItem => ({
    jobId: job.id,
    jobTitle: job.jobTitle,
    url: job.url,
    seniority: job.seniority,
    description: job.description,
});

export const JobSearchHandler = (jobsCollection: Collection<EnrichedJob>) => {
    const searchJobs = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const payload: unknown = request.body;
        if (!isJobSearchRequest(payload)) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid search payload" });
            return;
        }

        try {
            // This endpoint is an application-level ranking example. It can be replaced
            // by Atlas Vector Search without changing the API contract.
            const jobs = await jobsCollection.find({}).limit(500).toArray();
            const rankedJobs = jobs
                .map((job) => ({ job, score: scoreJob(job, payload) }))
                .sort((left, right) => right.score - left.score)
                .slice(0, 10)
                .map(({ job }) => toJobSearchResponseItem(job));

            reply.status(StatusCodes.OK).send(rankedJobs);
        } catch (error) {
            request.log.error({ error }, "Job search failed");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Job search failed" });
        }
    };

    return { searchJobs };
};
