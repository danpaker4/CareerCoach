import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import {
    ARBEITNOW_URL,
    JOBICY_URL,
    REMOTIVE_URL,
    adaptArbeitnow,
    adaptJobicy,
    adaptRemotive,
} from "./import-public-jobs.adapters";
import type { ImportOutcome, NormalizedPublicJob } from "./import-public-jobs.types";
import { isImportable, jobKey, withSourceCredit } from "./import-public-jobs.utils";

dotenv.config();

const DEFAULT_BASE_URL = "http://127.0.0.1:3003";
const DEFAULT_LIMIT = 60;

const SOURCES = [
    { name: "remotive", url: REMOTIVE_URL, adapt: adaptRemotive },
    { name: "arbeitnow", url: ARBEITNOW_URL, adapt: adaptArbeitnow },
    { name: "jobicy", url: JOBICY_URL, adapt: adaptJobicy },
] as const;

const fetchSource = async (
    source: (typeof SOURCES)[number]
): Promise<NormalizedPublicJob[]> => {
    try {
        const response = await fetch(source.url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
            console.warn(`${source.name}: HTTP ${response.status}`);
            return [];
        }
        const payload: unknown = await response.json();
        const jobs = source.adapt(payload).filter(isImportable);
        console.log(`${source.name}: ${jobs.length} usable postings`);
        return jobs;
    } catch (error) {
        console.warn(`${source.name}: request failed`, error);
        return [];
    }
};

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

const importJobs = async (): Promise<ImportOutcome> => {
    const baseUrl = (process.env.JOB_SERVICE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const limit = Number(process.env.IMPORT_LIMIT ?? DEFAULT_LIMIT);
    const outcome: ImportOutcome = { fetched: 0, created: 0, skipped: 0, failed: 0 };

    const batches = await Promise.all(SOURCES.map(fetchSource));
    const seen = await readExistingKeys();
    const queue: NormalizedPublicJob[] = [];

    for (const job of batches.flat()) {
        const key = jobKey(job.jobTitle, job.company);
        if (seen.has(key)) {
            outcome.skipped += 1;
            continue;
        }
        seen.add(key);
        queue.push(job);
    }
    outcome.fetched = batches.flat().length;

    for (const job of queue.slice(0, limit)) {
        try {
            const response = await fetch(`${baseUrl}/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobTitle: job.jobTitle,
                    company: job.company,
                    description: withSourceCredit(job.description, job.source, job.url),
                    seniority: job.seniority,
                    ...(job.location ? { location: job.location.slice(0, 200) } : {}),
                    ...(job.salary ? { salary: job.salary } : {}),
                    ...(job.requirements ? { requirements: job.requirements } : {}),
                    ...(job.url ? { url: job.url } : {}),
                }),
            });
            if (response.status === 201) {
                outcome.created += 1;
                console.log(`created  [${job.source}] ${job.jobTitle} @ ${job.company}`);
            } else {
                outcome.failed += 1;
                console.warn(`failed   [${job.source}] ${job.jobTitle} (${response.status})`);
            }
        } catch (error) {
            outcome.failed += 1;
            console.warn(`failed   [${job.source}] ${job.jobTitle}`, error);
        }
    }

    return outcome;
};

importJobs()
    .then(({ fetched, created, skipped, failed }) => {
        console.log(`\ndone: ${fetched} fetched, ${created} created, ${skipped} already present, ${failed} failed`);
        process.exit(0);
    })
    .catch((error: unknown) => {
        console.error("import failed", error);
        process.exit(1);
    });
