import type { Collection } from "mongodb";
import { adaptResource } from "./job-poller-api-stack/stages/adapt/adapt-resource";
import { enrichByGemini } from "./job-poller-api-stack/stages/enrich/enrich-by-gemini";
import type { EnrichedJob } from "./job-poller-api-stack/stages/enrich/types";
import { pollResource } from "./job-poller-api-stack/stages/polling/poll-resource";
import { saveEnrichedJobs } from "./job-poller-api-stack/stages/save/save-enriched-jobs";
import { jobPollerMock } from "./job-poller-mock/job-poller";

const TEN_MINUTES_MS = 10 * 60 * 1000;

export const startJobPollerSchedule = (jobsCollection: Collection<EnrichedJob>) => {
    const runState = { isRunning: false };

    const run = async () => {
        if (runState.isRunning) {
            console.log("⏭️ Skipping poller tick: previous run is still active");
            return;
        }

        runState.isRunning = true;
        try {
            // await jobPoller(jobsCollection);
            // await jobPollerMock(jobsCollection);
        } catch (error) {
            console.error("🔥 Job poller failed:", error);
        } finally {
            runState.isRunning = false;
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
    console.log(`✅ ${adaptedJobs.length} jobs adapted`);
    const enrichedJobs = await enrichByGemini(adaptedJobs);
    await saveEnrichedJobs(jobsCollection, enrichedJobs);

    console.log(`✅ Job poller completed: ${enrichedJobs.length} jobs processed`);
    return enrichedJobs;
};