import type { Collection } from "mongodb";
import { getJobEmbeddingConfig } from "../../../../ai/job-embedding.config";
import type { EnrichedJob } from "../enrich/types";

export const saveEnrichedJobs = async (
  jobsCollection: Collection<EnrichedJob>,
  jobs: EnrichedJob[],
): Promise<void> => {
  if (jobs.length === 0) {
    return;
  }

  await Promise.all(
    jobs.map(async (job) => {
      const now = new Date();
      const config = getJobEmbeddingConfig();
      const hasValidEmbedding = job.searchEmbedding.length === config.JOB_EMBEDDING_DIMENSIONS;
      await jobsCollection.updateOne(
        { id: job.id },
        {
          $set: {
            ...job,
            updatedAt: now,
            ...(hasValidEmbedding
              ? {
                  searchEmbeddingModel: config.JOB_EMBEDDING_MODEL,
                  searchEmbeddingUpdatedAt: now,
                  searchEmbeddingStatus: "ready" as const,
                }
              : { searchEmbeddingStatus: "pending" as const }),
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }),
  );
};
