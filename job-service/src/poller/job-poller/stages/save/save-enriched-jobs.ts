import type { Collection } from "mongodb";
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
      await jobsCollection.updateOne(
        { id: job.id },
        {
          $set: {
            ...job,
            updatedAt: now,
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
