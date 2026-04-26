import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

const VECTOR_INDEX_NAME = process.env.JOB_VECTOR_INDEX_NAME || "jobs_vector_index";
const VECTOR_MODEL = "text-embedding-004";
const SEARCH_LIMIT = 10;
const NUM_CANDIDATES = 100;

const buildQueryText = (request: JobSearchRequest): string => {
    const sections = [
        `Skills: ${request.skills.join(", ")}`,
        `Interests: ${request.interests.join(", ")}`,
        `Experience level: ${request.experienceLevel}`,
        `Keywords: ${request.keywords.join(", ")}`,
    ];
    return sections.join("\n");
};

const toJobSearchResponseItem = (job: EnrichedJob): JobSearchResponseItem => ({
    jobId: job.id,
    jobTitle: job.jobTitle,
    url: job.url,
    seniority: job.seniority,
    description: job.description,
});

export const JobSearchHandler = (jobsCollection: Collection<EnrichedJob>) => {
    const embeddingApiKey = process.env.GEMINI_API_KEY;
    const embeddingModel = embeddingApiKey
        ? new GoogleGenerativeAI(embeddingApiKey).getGenerativeModel({ model: VECTOR_MODEL })
        : null;

    const searchJobs = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const payload: unknown = request.body;
        if (!isJobSearchRequest(payload)) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid search payload" });
            return;
        }

        if (!embeddingModel) {
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "GEMINI_API_KEY is required for vector job search" });
            return;
        }

        try {
            const queryText = buildQueryText(payload);
            const embeddingResult = await embeddingModel.embedContent(queryText);
            const queryVector = embeddingResult.embedding?.values;
            if (!Array.isArray(queryVector)) {
                reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Failed generating query embedding" });
                return;
            }

            const rankedJobs = await jobsCollection.aggregate([
                {
                    $vectorSearch: {
                        index: VECTOR_INDEX_NAME,
                        path: "searchEmbedding",
                        queryVector,
                        numCandidates: NUM_CANDIDATES,
                        limit: SEARCH_LIMIT,
                    },
                },
                {
                    $project: {
                        _id: 0,
                        id: 1,
                        jobTitle: 1,
                        url: 1,
                        seniority: 1,
                        description: 1,
                    },
                },
            ]).toArray();

            const responsePayload = rankedJobs.map((job) => toJobSearchResponseItem(job as EnrichedJob));

            reply.status(StatusCodes.OK).send(responsePayload);
        } catch (error) {
            request.log.error({ error }, "Job search failed");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Job search failed" });
        }
    };

    return { searchJobs };
};
