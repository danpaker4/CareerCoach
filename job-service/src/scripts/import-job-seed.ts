import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import type { EnrichedJob } from "../poller/job-poller-api-stack/stages/enrich/types";
import { saveEnrichedJobs } from "../poller/job-poller-api-stack/stages/save/save-enriched-jobs";
import { JOB_SEED_COLLECTION } from "./job-seed.consts";
import { JobSeedEnvSchema, JobSeedListSchema } from "./job-seed.schema";
import type { JobSeed } from "./job-seed.types";
import { toSeededJob } from "./job-seed.utils";
import rawJobSeed from "./mock-jobs.seed.json";

dotenv.config();

const runImport = async (): Promise<void> => {
    const env = JobSeedEnvSchema.parse(process.env);
    const seed: readonly JobSeed[] = JobSeedListSchema.parse(rawJobSeed);
    if (seed.length === 0) {
        throw new Error("The repository job seed is empty; run npm run export:job-seed locally first");
    }

    const client = new MongoClient(env.MONGO_CONNECTION_STRING);
    await client.connect();
    try {
        const jobsCollection = client.db().collection<EnrichedJob>(JOB_SEED_COLLECTION);
        await saveEnrichedJobs(jobsCollection, seed.map(toSeededJob));
        console.log(`Imported ${seed.length} job seeds into ${JOB_SEED_COLLECTION}`);
    } finally {
        await client.close();
    }
};

runImport().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
