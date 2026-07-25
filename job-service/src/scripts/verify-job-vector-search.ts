import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { getJobEmbeddingConfig } from "../ai/job-embedding.config";
import type { EnrichedJob } from "../poller/job-poller-api-stack/stages/enrich/types";
import { JOBS_PAGE_SIZE } from "../routes/jobs/jobs.consts";
import { vectorSearchJobsPage } from "../routes/jobs/semantic-search";
import { isSearchIndexReady, parseSearchIndexState } from "../mongo/job-vector-index.utils";

dotenv.config();

const runVerification = async (): Promise<void> => {
    const config = getJobEmbeddingConfig();
    if (!config.JOBS_VECTOR_SEARCH_ENABLED) {
        throw new Error("JOBS_VECTOR_SEARCH_ENABLED must be true to verify vector search");
    }
    const mongoConnectionString = process.env.MONGO_CONNECTION_STRING;
    if (!mongoConnectionString) {
        throw new Error("MONGO_CONNECTION_STRING is required");
    }

    const client = new MongoClient(mongoConnectionString);
    await client.connect();
    try {
        const collection = client.db().collection<EnrichedJob>("jobs");
        const rawIndexes: unknown[] = await collection
            .listSearchIndexes(config.JOB_VECTOR_INDEX_NAME)
            .toArray();
        const indexState = rawIndexes.length > 0
            ? parseSearchIndexState(rawIndexes[0])
            : null;
        if (!indexState || !isSearchIndexReady(indexState, config.JOB_EMBEDDING_DIMENSIONS)) {
            throw new Error(`Vector index ${config.JOB_VECTOR_INDEX_NAME} is not queryable`);
        }

        const sampleJob = await collection.findOne({
            searchEmbeddingStatus: "ready",
            [`searchEmbedding.${config.JOB_EMBEDDING_DIMENSIONS - 1}`]: { $exists: true },
            createdAt: { $type: "date" },
        });
        if (!sampleJob?.searchEmbedding) {
            throw new Error("No ready job embedding is available for a vector query");
        }

        const results = await vectorSearchJobsPage(
            collection,
            sampleJob.searchEmbedding,
            0,
            new Date(),
            config.JOB_VECTOR_INDEX_NAME,
        );
        if (results.length === 0) {
            throw new Error("The vector query completed but returned no jobs");
        }

        console.log(JSON.stringify({
            index: config.JOB_VECTOR_INDEX_NAME,
            indexStatus: indexState.status,
            queryable: indexState.queryable,
            results: Math.min(results.length, JOBS_PAGE_SIZE),
            topJobId: results[0].id,
        }));
    } finally {
        await client.close();
    }
};

runVerification().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
