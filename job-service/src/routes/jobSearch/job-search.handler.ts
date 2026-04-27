import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
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
const VECTOR_MODEL = process.env.JOB_EMBEDDING_MODEL || "text-embedding-004";
const SEARCH_LIMIT = 10;
const NUM_CANDIDATES = 100;
const FALLBACK_VECTOR_MODELS = ["gemini-embedding-001", "embedding-001"] as const;
const MAX_EMBEDDING_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 400;

type EmbeddingFetchError = {
    status?: number;
    statusText?: string;
};

const sleep = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

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
    const embeddingClient = embeddingApiKey ? new GoogleGenerativeAI(embeddingApiKey) : null;

    const generateQueryVector = async (queryText: string): Promise<number[] | null> => {
        if (!embeddingClient) {
            return null;
        }

        const modelCandidates = [VECTOR_MODEL, ...FALLBACK_VECTOR_MODELS];
        for (const modelName of modelCandidates) {
            for (let attempt = 1; attempt <= MAX_EMBEDDING_RETRIES; attempt += 1) {
                try {
                    const model = embeddingClient.getGenerativeModel({ model: modelName });
                    const embeddingResult = await model.embedContent(queryText);
                    const queryVector = embeddingResult.embedding?.values;
                    return Array.isArray(queryVector) ? queryVector : null;
                } catch (error) {
                    const embeddingError = error as EmbeddingFetchError;
                    const isNotFound = embeddingError.status === 404;
                    const isRateLimited = embeddingError.status === 429;
                    if (isNotFound) {
                        break;
                    }
                    if (!isRateLimited || attempt === MAX_EMBEDDING_RETRIES) {
                        throw error;
                    }
                    const delay = RETRY_BASE_DELAY_MS * attempt;
                    await sleep(delay);
                }
            }
        }

        return null;
    };

    const searchJobs = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const payload: unknown = request.body;
        if (!isJobSearchRequest(payload)) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid search payload" });
            return;
        }

        try {
            const queryText = buildQueryText(payload);
            const queryVector = embeddingClient ? await generateQueryVector(queryText) : null;
            if (!queryVector) {
                reply.status(StatusCodes.OK).send([]);
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
            const embeddingError = error as EmbeddingFetchError;
            if (embeddingError.status === 429) {
                reply.status(StatusCodes.TOO_MANY_REQUESTS).send({ error: "Embedding provider rate limited; retry shortly" });
                return;
            }
            request.log.error({ error }, "Job search failed");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Job search failed" });
        }
    };

    return { searchJobs };
};
