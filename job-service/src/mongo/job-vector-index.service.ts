import type { Collection } from "mongodb";
import type { JobEmbeddingConfig } from "../ai/job-embedding.config";
import type { EnrichedJob } from "../poller/job-poller-api-stack/stages/enrich/types";
import { JOB_VECTOR_INDEX_POLL_INTERVAL_MS } from "./job-vector-index.consts";
import {
    createJobVectorIndexDefinition,
    delay,
    isExpectedJobVectorIndex,
    isSearchIndexReady,
    parseSearchIndexState,
} from "./job-vector-index.utils";

const readIndexState = async (
    collection: Collection<EnrichedJob>,
    indexName: string,
) => {
    const rawIndexes: unknown[] = await collection.listSearchIndexes(indexName).toArray();
    return rawIndexes.length > 0 ? parseSearchIndexState(rawIndexes[0]) : null;
};

const waitForReadyIndex = async (
    collection: Collection<EnrichedJob>,
    config: JobEmbeddingConfig,
    deadline: number,
): Promise<void> => {
    const state = await readIndexState(collection, config.JOB_VECTOR_INDEX_NAME);
    if (state && isSearchIndexReady(state, config.JOB_EMBEDDING_DIMENSIONS)) return;
    if (Date.now() >= deadline) {
        const status = state?.status ?? "MISSING";
        throw new Error(
            `Vector search index ${config.JOB_VECTOR_INDEX_NAME} was not queryable within ` +
            `${config.JOB_VECTOR_INDEX_READY_TIMEOUT_MS}ms (status: ${status})`,
        );
    }
    await delay(JOB_VECTOR_INDEX_POLL_INTERVAL_MS);
    await waitForReadyIndex(collection, config, deadline);
};

export const ensureJobVectorSearchIndex = async (
    collection: Collection<EnrichedJob>,
    config: JobEmbeddingConfig,
): Promise<void> => {
    const definition = createJobVectorIndexDefinition(config.JOB_EMBEDDING_DIMENSIONS);
    const state = await readIndexState(collection, config.JOB_VECTOR_INDEX_NAME);

    if (!state) {
        await collection.createSearchIndex({
            name: config.JOB_VECTOR_INDEX_NAME,
            type: "vectorSearch",
            definition,
        });
    } else if (!isExpectedJobVectorIndex(state, config.JOB_EMBEDDING_DIMENSIONS)) {
        await collection.updateSearchIndex(config.JOB_VECTOR_INDEX_NAME, definition);
    }

    await waitForReadyIndex(
        collection,
        config,
        Date.now() + config.JOB_VECTOR_INDEX_READY_TIMEOUT_MS,
    );
};
