import { writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import type { EnrichedJob } from "../poller/job-poller-api-stack/stages/enrich/types";
import { JOB_SEED_COLLECTION, JOB_SEED_PATH } from "./job-seed.consts";
import { JobSeedEnvSchema } from "./job-seed.schema";
import { toJobSeed } from "./job-seed.utils";

dotenv.config();

const runExport = async (): Promise<void> => {
    const env = JobSeedEnvSchema.parse(process.env);
    const client = new MongoClient(env.MONGO_CONNECTION_STRING);

    await client.connect();
    try {
        const jobs = await client
            .db()
            .collection<EnrichedJob>(JOB_SEED_COLLECTION)
            .find({})
            .sort({ id: 1 })
            .toArray();
        if (jobs.length === 0) {
            throw new Error("The local jobs collection is empty; refusing to replace the repository seed");
        }

        const seed = jobs.map(toJobSeed);
        await writeFile(JOB_SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
        console.log(`Exported ${seed.length} jobs to ${JOB_SEED_PATH}`);
    } finally {
        await client.close();
    }
};

runExport().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
