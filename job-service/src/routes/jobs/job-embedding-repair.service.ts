import type { Collection } from "mongodb";
import { getJobEmbeddingConfig } from "../../ai/job-embedding.config";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import {
    buildSearchableText,
    createEmbedding,
    createEmbeddingClient,
} from "../../poller/job-poller-api-stack/stages/enrich/embedding";

const REPAIR_BATCH_SIZE = 25;
const REPAIR_INTERVAL_MS = 15 * 60 * 1_000;

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

export const repairPendingJobEmbeddings = async (
    jobsCollection: Collection<EnrichedJob>,
    batchSize = REPAIR_BATCH_SIZE,
): Promise<void> => {
    const config = getJobEmbeddingConfig();
    if (!config.GEMINI_API_KEY) return;

    const jobs = await jobsCollection.find({
        $or: [
            { searchEmbeddingStatus: { $ne: "ready" } },
            { searchEmbeddingModel: { $ne: config.JOB_EMBEDDING_MODEL } },
        ],
    }).limit(batchSize).toArray();
    if (jobs.length === 0) return;

    const embeddingClient = createEmbeddingClient(config.GEMINI_API_KEY);
    await jobs.reduce<Promise<void>>(async (previousRepair, job) => {
        await previousRepair;
        const searchableText = getSearchableText(job);
        await createEmbedding(embeddingClient, searchableText)
            .then(async (searchEmbedding) => {
                const now = new Date();
                await jobsCollection.updateOne(
                    { id: job.id },
                    {
                        $set: {
                            searchableText,
                            searchEmbedding,
                            searchEmbeddingModel: config.JOB_EMBEDDING_MODEL,
                            searchEmbeddingUpdatedAt: now,
                            searchEmbeddingStatus: "ready",
                            updatedAt: now,
                        },
                    },
                );
            })
            .catch(async (error: unknown) => {
                await jobsCollection.updateOne(
                    { id: job.id },
                    { $set: { searchEmbeddingStatus: "failed" } },
                );
                console.warn(`Job embedding repair failed for ${job.id}`, error);
            });
    }, Promise.resolve());
};

export const startJobEmbeddingRepairSchedule = (jobsCollection: Collection<EnrichedJob>): void => {
    repairPendingJobEmbeddings(jobsCollection).catch((error: unknown) => {
        console.warn("Initial job embedding repair failed", error);
    });
    setInterval(() => {
        repairPendingJobEmbeddings(jobsCollection).catch((error: unknown) => {
            console.warn("Scheduled job embedding repair failed", error);
        });
    }, REPAIR_INTERVAL_MS);
};
