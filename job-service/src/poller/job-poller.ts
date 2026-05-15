import type { Collection } from "mongodb";
import { LlmTokenUsageRepository } from "../llm-token-usage/llm-token-usage.repository";
import type { LlmTokenUsageDocument } from "../llm-token-usage/llm-token-usage.types";
import { adaptResource } from "./job-poller-api-stack/stages/adapt/adapt-resource";
import { enrichByGemini } from "./job-poller-api-stack/stages/enrich/enrich-by-gemini";
import type { EnrichedJob } from "./job-poller-api-stack/stages/enrich/types";
import { pollResource } from "./job-poller-api-stack/stages/polling/poll-resource";
import { saveEnrichedJobs } from "./job-poller-api-stack/stages/save/save-enriched-jobs";
import { jobPollerMock } from "./job-poller-mock/job-poller";

const TEN_MINUTES_MS = 10 * 60 * 1000;

export const startJobPollerSchedule = (
    jobsCollection: Collection<EnrichedJob>,
    tokenUsageCollection: Collection<LlmTokenUsageDocument>
) => {
    const runState = { isRunning: false };
    const tokenUsageRepository = new LlmTokenUsageRepository(tokenUsageCollection);

    const run = async () => {
        if (runState.isRunning) {
            console.log("⏭️ Skipping poller tick: previous run is still active");
            return;
        }

        runState.isRunning = true;
        try {
            const provider = process.env.LLM_PROVIDER || "ollama";
            const model = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || "llama3";
            console.info(`[LLM] Poller run provider=${provider} model=${model}`);
            // await jobPoller(jobsCollection, tokenUsageRepository);
            // await jobPollerMock(jobsCollection, tokenUsageRepository);
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

export const jobPoller = async (jobsCollection: Collection<EnrichedJob>, tokenUsageRepository?: LlmTokenUsageRepository) => {
    console.log("🔄 Starting Job Poller...");
    const provider = process.env.LLM_PROVIDER || "ollama";
    const model = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || "llama3";
    console.info(`[LLM] Job poller enrichment provider=${provider} model=${model}`);
    const resource = await pollResource();
    console.log(`✅ ${resource.length} jobs polled`);
    const adaptedJobs = adaptResource(resource);
    console.log(`✅ ${adaptedJobs.length} jobs adapted`);
    const enrichedJobs = await enrichByGemini(adaptedJobs, tokenUsageRepository);
    await saveEnrichedJobs(jobsCollection, enrichedJobs);

    console.log(`✅ Job poller completed: ${enrichedJobs.length} jobs processed`);
    return enrichedJobs;
};
