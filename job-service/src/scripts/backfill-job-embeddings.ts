import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { getJobEmbeddingConfig } from "../ai/job-embedding.config";
import type { EnrichedJob } from "../poller/job-poller-api-stack/stages/enrich/types";
import {
    buildSearchableText,
    createEmbedding,
    createEmbeddingClient,
} from "../poller/job-poller-api-stack/stages/enrich/embedding";
import { delay } from "../ai/embedding-retry.utils";
import { JOB_EMBEDDING_BACKFILL_REQUEST_INTERVAL_MS } from "./backfill-job-embeddings.consts";

dotenv.config();

const getSearchableText = (job: EnrichedJob): string =>
    job.searchableText?.trim() ||
    buildSearchableText({
        jobTitle: job.jobTitle,
        description: job.description,
        requirements: job.requirements ?? [],
        benefits: job.benefits ?? [],
        languages: job.languages ?? [],
        frameworks: job.frameworks ?? [],
        databases: job.databases ?? [],
        platforms: job.platforms ?? [],
        tools: job.tools ?? [],
        mustKnowSkills: job.mustKnowSkills ?? [],
        niceToHaveSkills: job.niceToHaveSkills ?? [],
    });

const runBackfill = async (): Promise<void> => {
    const config = getJobEmbeddingConfig();
    if (!config.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required to backfill job embeddings");
    }
    const mongoConnectionString = process.env.MONGO_CONNECTION_STRING;
    if (!mongoConnectionString) {
        throw new Error("MONGO_CONNECTION_STRING is required");
    }

    const client = new MongoClient(mongoConnectionString);
    await client.connect();
    try {
        const jobsCollection = client.db().collection<EnrichedJob>("jobs");
        const metadataUpdatedAt = new Date();
        const metadataResult = await jobsCollection.updateMany(
            {
                $expr: {
                    $ne: [{ $type: "$createdAt" }, "date"],
                },
            },
            {
                $set: {
                    createdAt: metadataUpdatedAt,
                    updatedAt: metadataUpdatedAt,
                },
            },
        );
        const jobs = await jobsCollection.find({}).toArray();
        const jobsToBackfill = jobs.filter(
            (job) =>
                !Array.isArray(job.searchEmbedding) ||
                job.searchEmbedding.length !== config.JOB_EMBEDDING_DIMENSIONS ||
                job.searchEmbeddingModel !== config.JOB_EMBEDDING_MODEL ||
                job.searchEmbeddingStatus !== "ready",
        );
        const embeddingClient = createEmbeddingClient(config.GEMINI_API_KEY);
        const results = await jobsToBackfill.reduce<Promise<boolean[]>>(async (resultsPromise, job) => {
            const resultsSoFar = await resultsPromise;
            const succeeded = await createEmbedding(embeddingClient, getSearchableText(job))
                .then(async (searchEmbedding) => {
                    const now = new Date();
                    await jobsCollection.updateOne(
                        { id: job.id },
                        {
                            $set: {
                                searchableText: getSearchableText(job),
                                searchEmbedding,
                                searchEmbeddingModel: config.JOB_EMBEDDING_MODEL,
                                searchEmbeddingUpdatedAt: now,
                                searchEmbeddingStatus: "ready",
                                updatedAt: now,
                            },
                        },
                    );
                    return true;
                })
                .catch(async (error: unknown) => {
                    await jobsCollection.updateOne(
                        { id: job.id },
                        { $set: { searchEmbeddingStatus: "failed" } },
                    );
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(`Job embedding backfill failed for job ${job.id}: ${message}`);
                    return false;
                });
            await delay(JOB_EMBEDDING_BACKFILL_REQUEST_INTERVAL_MS);
            return [...resultsSoFar, succeeded];
        }, Promise.resolve([]));
        const succeeded = results.filter(Boolean).length;
        console.log(JSON.stringify({
            metadataNormalized: metadataResult.modifiedCount,
            eligible: jobsToBackfill.length,
            succeeded,
            failed: results.length - succeeded,
        }));
    } finally {
        await client.close();
    }
};

runBackfill().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
