import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { SAMPLE_JOBS } from "./seed-sample-jobs.data";

dotenv.config();

const DEFAULT_BASE_URL = "http://127.0.0.1:3003";

type SeedOutcome = { created: number; skipped: number; failed: number };

const jobKey = (jobTitle: string, company: string): string =>
    `${jobTitle.trim().toLowerCase()}@${company.trim().toLowerCase()}`;

const readExistingKeys = async (): Promise<Set<string>> => {
    const mongoConnectionString = process.env.MONGO_CONNECTION_STRING;
    if (!mongoConnectionString) {
        throw new Error("MONGO_CONNECTION_STRING is required");
    }
    const client = new MongoClient(mongoConnectionString);
    await client.connect();
    try {
        const stored = await client
            .db()
            .collection<{ jobTitle?: string; company?: string }>("jobs")
            .find({}, { projection: { _id: 0, jobTitle: 1, company: 1 } })
            .toArray();
        return new Set(stored.map((job) => jobKey(job.jobTitle ?? "", job.company ?? "")));
    } finally {
        await client.close();
    }
};

const seed = async (): Promise<SeedOutcome> => {
    const baseUrl = (process.env.JOB_SERVICE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const existing = await readExistingKeys();
    const outcome: SeedOutcome = { created: 0, skipped: 0, failed: 0 };

    for (const job of SAMPLE_JOBS) {
        if (existing.has(jobKey(job.jobTitle, job.company))) {
            outcome.skipped += 1;
            continue;
        }
        try {
            const response = await fetch(`${baseUrl}/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(job),
            });
            if (response.status === 201) {
                outcome.created += 1;
                console.log(`created  ${job.jobTitle} @ ${job.company}`);
            } else {
                outcome.failed += 1;
                console.warn(`failed   ${job.jobTitle} @ ${job.company} (${response.status})`);
            }
        } catch (error) {
            outcome.failed += 1;
            console.warn(`failed   ${job.jobTitle} @ ${job.company}`, error);
        }
    }

    return outcome;
};

seed()
    .then(({ created, skipped, failed }) => {
        console.log(`\ndone: ${created} created, ${skipped} already present, ${failed} failed`);
        process.exit(failed > 0 ? 1 : 0);
    })
    .catch((error: unknown) => {
        console.error("seeding failed", error);
        process.exit(1);
    });
