import type { Collection } from "mongodb";
import { LlmTokenUsageRepository } from "../llm-token-usage/llm-token-usage.repository";
import type { LlmTokenUsageDocument } from "../llm-token-usage/llm-token-usage.types";
import { withSpan } from "../observability/tracing";
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

    const run = async (): Promise<void> => {
        if (runState.isRunning) {
            console.log("⏭️ Skipping poller tick: previous run is still active");
            return;
        }

        runState.isRunning = true;
        const provider = process.env.LLM_PROVIDER || "ollama";
        const model = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || "llama3";

        await withSpan("job.poller.run", {
            "llm.provider": provider,
            "llm.model": model,
        }, async (span) => {
            try {
                console.info(`[LLM] Poller run provider=${provider} model=${model}`);
                // await jobPoller(jobsCollection, tokenUsageRepository);
                // await jobPollerMock(jobsCollection, tokenUsageRepository);
                span.setAttribute("job.poller.status", "success");
            } catch (error) {
                span.setAttribute("job.poller.status", "error");
                console.error("🔥 Job poller failed:", error);
            } finally {
                runState.isRunning = false;
            }
        });
    };

    void run();
    setInterval(() => {
        void run();
    }, TEN_MINUTES_MS);
};

export const jobPoller = async (
    jobsCollection: Collection<EnrichedJob>,
    tokenUsageRepository?: LlmTokenUsageRepository
): Promise<EnrichedJob[]> => {
    const provider = process.env.LLM_PROVIDER || "ollama";
    const model = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || "llama3";

    return await withSpan("job.poller.run", {
        "llm.provider": provider,
        "llm.model": model,
    }, async (span) => {
        console.log("🔄 Starting Job Poller...");
        console.info(`[LLM] Job poller enrichment provider=${provider} model=${model}`);

        const resource = await withSpan("job.poller.poll_resource", {}, async (pollSpan) => {
            const polledJobs = await pollResource();
            pollSpan.setAttribute("job.count", polledJobs.length);
            return polledJobs;
        });
        console.log(`✅ ${resource.length} jobs polled`);

        const adaptedJobs = adaptResource(resource);
        span.setAttribute("job.adapted.count", adaptedJobs.length);
        console.log(`✅ ${adaptedJobs.length} jobs adapted`);

        const enrichedJobs = await withSpan("job.poller.enrich", {
            "job.count": adaptedJobs.length,
            "llm.provider": provider,
            "llm.model": model,
        }, async (enrichSpan) => {
            const enriched = await enrichByGemini(adaptedJobs, tokenUsageRepository);
            enrichSpan.setAttribute("job.enriched.count", enriched.length);
            return enriched;
        });

        await withSpan("job.poller.save", {
            "job.count": enrichedJobs.length,
        }, async (saveSpan) => {
            await saveEnrichedJobs(jobsCollection, enrichedJobs);
            saveSpan.setAttribute("job.saved.count", enrichedJobs.length);
        });

        span.setAttribute("job.count", enrichedJobs.length);
        console.log(`✅ Job poller completed: ${enrichedJobs.length} jobs processed`);
        return enrichedJobs;
    });
};
