import { pollResource } from "./stages/polling/poll-resource";
import { adaptResource } from "./stages/adapt/adapt-resource";
import { enrichByGemini } from "./stages/enrich/enrich-by-gemini";
import { saveEnrichedJobs } from "./stages/save/save-enriched-jobs";
import { mkdir, writeFile } from "fs/promises";
import * as path from "path";
import type { Collection } from "mongodb";
import type { EnrichedJob } from "./stages/enrich/types";

const TEN_MINUTES_MS = 10 * 60 * 1000;

export const startJobPollerSchedule = (jobsCollection: Collection<EnrichedJob>) => {
    let isRunning = false;

    const run = async () => {
        if (isRunning) {
            console.log("⏭️ Skipping poller tick: previous run is still active");
            return;
        }

        isRunning = true;
        try {
            await jobPoller(jobsCollection);
        } catch (error) {
            console.error("🔥 Job poller failed:", error);
        } finally {
            isRunning = false;
        }
    };

    void run();
    setInterval(() => {
        void run();
    }, TEN_MINUTES_MS);
};

export const jobPoller = async (jobsCollection: Collection<EnrichedJob>) => {
    console.log("🔄 Starting Job Poller...");
    const resource = await pollResource();
    console.log(`✅ ${resource.length} jobs polled`);
    const adaptedJobs = adaptResource(resource);
    const outputDir = path.resolve(process.cwd(), "poller-output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(
        path.join(outputDir, "adapted-jobs.json"),
        JSON.stringify(adaptedJobs, null, 2),
        "utf-8",
    );
    console.log(`✅ ${adaptedJobs.length} jobs adapted`);
    const enrichedJobs = await enrichByGemini(adaptedJobs);
    await writeFile(
        path.join(outputDir, "enriched-jobs.json"),
        JSON.stringify(enrichedJobs, null, 2),
        "utf-8",
    );
    await saveEnrichedJobs(jobsCollection, enrichedJobs);

    console.log(`✅ Job poller completed: ${enrichedJobs.length} jobs processed`);
    return enrichedJobs;
};