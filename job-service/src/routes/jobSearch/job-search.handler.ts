import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { JobSearchPlanRequest, JobSearchRequest, JobSearchResponseItem } from "./job-search.types";
import { generateQueryVector } from "../../ai/embedding.utils";

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

const isJobSearchPlanRequest = (body: unknown): body is JobSearchPlanRequest => {
    if (typeof body !== "object" || body === null) {
        return false;
    }
    const payload = body as Record<string, unknown>;
    if (!Array.isArray(payload.searches)) {
        return false;
    }
    return payload.searches.every((search) =>
        typeof search === "object"
        && search !== null
        && "type" in search
        && "query" in search
        && "filters" in search
        && typeof (search as { query?: unknown }).query === "string"
        && isJobSearchRequest((search as { filters?: unknown }).filters)
    );
};

const VECTOR_INDEX_NAME = process.env.JOB_VECTOR_INDEX_NAME || "jobs_vector_index";
const SEARCH_LIMIT = 10;
const NUM_CANDIDATES = 100;

type EmbeddingFetchError = {
    status?: number;
    statusText?: string;
};

type MongoSearchError = {
    code?: number;
    codeName?: string;
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

const toStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const toJobSearchResponseItem = (job: EnrichedJob): JobSearchResponseItem => ({
    jobId: job.id,
    jobTitle: job.jobTitle,
    url: job.url,
    seniority: job.seniority,
    description: job.description,
    company: typeof job.company === "string" ? job.company : "",
    salary: typeof job.salary === "number" ? job.salary : 0,
    requirements: toStringArray(job.requirements),
    mustKnowSkills: toStringArray(job.mustKnowSkills),
    niceToHaveSkills: toStringArray(job.niceToHaveSkills),
    benefits: toStringArray(job.benefits),
});

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildTitleCandidates = (request: JobSearchRequest): string[] => {
    const rawPhrases = [
        ...request.keywords,
        ...request.interests,
        request.keywords.join(" "),
        request.interests.join(" "),
    ].map((value) => value.trim()).filter((value) => value.length > 0);

    const expanded = rawPhrases.flatMap((phrase) => {
        const lowered = phrase.toLowerCase();
        const variants = [phrase];
        if (lowered.includes("management")) {
            variants.push(phrase.replace(/management/gi, "manager"));
        }
        if (lowered.includes("manager")) {
            variants.push(phrase.replace(/manager/gi, "management"));
        }
        if (lowered.includes("cyber security")) {
            variants.push(phrase.replace(/cyber security/gi, "cybersecurity"));
        }
        if (lowered.includes("cybersecurity")) {
            variants.push(phrase.replace(/cybersecurity/gi, "cyber security"));
        }
        return variants;
    });

    return expanded.filter((value, index, arr) => arr.indexOf(value) === index);
};

export const JobSearchHandler = (jobsCollection: Collection<EnrichedJob>) => {
    const searchByJobTitleFallback = async (requestBody: JobSearchRequest): Promise<JobSearchResponseItem[]> => {
        const titleCandidates = buildTitleCandidates(requestBody);
        if (titleCandidates.length === 0) {
            return [];
        }

        const exactTitleOr = titleCandidates.map((title) => ({
            jobTitle: { $regex: `^${escapeRegex(title)}$`, $options: "i" },
        }));
        const exactMatches = await jobsCollection.find(
            { $or: exactTitleOr },
            {
                projection: {
                    _id: 0,
                    id: 1,
                    jobTitle: 1,
                    url: 1,
                    seniority: 1,
                    description: 1,
                    company: 1,
                    salary: 1,
                    requirements: 1,
                    mustKnowSkills: 1,
                    niceToHaveSkills: 1,
                    benefits: 1,
                },
            }
        ).limit(SEARCH_LIMIT).toArray();
        if (exactMatches.length >= SEARCH_LIMIT) {
            return exactMatches.map((job) => toJobSearchResponseItem(job as EnrichedJob));
        }

        const partialTitleOr = titleCandidates.map((title) => ({
            jobTitle: { $regex: escapeRegex(title), $options: "i" },
        }));
        const partialMatches = await jobsCollection.find(
            { $or: partialTitleOr },
            {
                projection: {
                    _id: 0,
                    id: 1,
                    jobTitle: 1,
                    url: 1,
                    seniority: 1,
                    description: 1,
                    company: 1,
                    salary: 1,
                    requirements: 1,
                    mustKnowSkills: 1,
                    niceToHaveSkills: 1,
                    benefits: 1,
                },
            }
        ).limit(SEARCH_LIMIT).toArray();
        const mergedMatches = [...exactMatches, ...partialMatches].filter(
            (job, index, jobs) => jobs.findIndex((candidate) => candidate.id === job.id) === index
        ).slice(0, SEARCH_LIMIT);

        return mergedMatches.map((job) => toJobSearchResponseItem(job as EnrichedJob));
    };

    const searchJobs = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const payload: unknown = request.body;
        const normalizedSearches = isJobSearchPlanRequest(payload)
            ? payload.searches.map((search) => search.filters)
            : isJobSearchRequest(payload)
                ? [payload]
                : null;
        if (!normalizedSearches) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid search payload" });
            return;
        }

        try {
            const allResults: JobSearchResponseItem[] = [];
            for (const searchRequest of normalizedSearches) {
                const queryText = buildQueryText(searchRequest);
                const queryVector = await generateQueryVector(queryText);
                if (!queryVector) {
                    const fallbackResults = await searchByJobTitleFallback(searchRequest);
                    allResults.push(...fallbackResults);
                    continue;
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
                            company: 1,
                            salary: 1,
                            requirements: 1,
                            mustKnowSkills: 1,
                            niceToHaveSkills: 1,
                            benefits: 1,
                        },
                    },
                ]).toArray();
                const responsePayload = rankedJobs.map((job) => toJobSearchResponseItem(job as EnrichedJob));
                if (responsePayload.length > 0) {
                    allResults.push(...responsePayload);
                    continue;
                }
                const fallbackResults = await searchByJobTitleFallback(searchRequest);
                allResults.push(...fallbackResults);
            }

            const deduped = allResults.filter((job, index, jobs) => jobs.findIndex((candidate) => candidate.jobId === job.jobId) === index);
            reply.status(StatusCodes.OK).send(deduped.slice(0, 30));
        } catch (error) {
            const embeddingError = error as EmbeddingFetchError;
            if (embeddingError.status === 429) {
                const fallbackRequest = normalizedSearches[0];
                const fallbackResults = await searchByJobTitleFallback(fallbackRequest);
                reply.status(StatusCodes.OK).send(fallbackResults);
                return;
            }
            const mongoError = error as MongoSearchError;
            const isSearchNotEnabled = mongoError.code === 31082 || mongoError.codeName === "SearchNotEnabled";
            if (isSearchNotEnabled) {
                const fallbackRequest = normalizedSearches[0];
                const fallbackResults = await searchByJobTitleFallback(fallbackRequest);
                reply.status(StatusCodes.OK).send(fallbackResults);
                return;
            }
            request.log.error({ error }, "Job search failed");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Job search failed" });
        }
    };

    return { searchJobs };
};
