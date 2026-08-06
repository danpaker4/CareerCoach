import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const outputPath = process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length);
if (!outputPath) {
    throw new Error("Usage: npx tsx src/scripts/benchmark-vector-latency.ts --output=PATH");
}

const connectionString = process.env.MONGO_CONNECTION_STRING
    ?? "mongodb://127.0.0.1:27018/careerCoachDB?directConnection=true";
const client = new MongoClient(connectionString);

const percentile = (values: readonly number[], fraction: number): number => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
};

const run = async (): Promise<void> => {
    await client.connect();
    const database = client.db();
    const jobs = database.collection<{ id: string; searchEmbedding: number[] }>("jobs");
    const samples = await jobs.find(
        { "searchEmbedding.0": { $exists: true } },
        { projection: { _id: 0, id: 1, searchEmbedding: 1 } },
    ).sort({ id: 1 }).limit(55).toArray();
    const durationsMs: number[] = [];
    const resultCounts: number[] = [];

    for (const [index, sample] of samples.entries()) {
        const start = performance.now();
        const results = await jobs.aggregate([
            {
                $vectorSearch: {
                    index: "jobs_search_embedding_vector_index",
                    path: "searchEmbedding",
                    queryVector: sample.searchEmbedding,
                    numCandidates: 1_000,
                    limit: 51,
                    filter: { createdAt: { $lte: new Date() } },
                },
            },
            { $limit: 51 },
            { $project: { _id: 0, id: 1 } },
        ]).toArray();
        const durationMs = performance.now() - start;
        if (index >= 5) {
            durationsMs.push(durationMs);
            resultCounts.push(results.length);
        }
    }

    const artifact = {
        protocolVersion: 1,
        measuredAt: new Date().toISOString(),
        warmupQueries: 5,
        measuredQueries: durationsMs.length,
        numCandidates: 1_000,
        limit: 51,
        medianMs: percentile(durationsMs, 0.5),
        p95Ms: percentile(durationsMs, 0.95),
        meanMs: durationsMs.reduce((sum, duration) => sum + duration, 0) / durationsMs.length,
        minMs: Math.min(...durationsMs),
        maxMs: Math.max(...durationsMs),
        resultCountMin: Math.min(...resultCounts),
        resultCountMax: Math.max(...resultCounts),
        durationsMs,
    };
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(artifact, null, 2));
};

run()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await client.close();
    });
