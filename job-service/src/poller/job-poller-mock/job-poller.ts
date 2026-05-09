import type { Collection } from "mongodb";
import { createEmbedding, createEmbeddingClient } from "../job-poller-api-stack/stages/enrich/embedding";
import type { EnrichedJob } from "../job-poller-api-stack/stages/enrich/types";
import { saveEnrichedJobs } from "../job-poller-api-stack/stages/save/save-enriched-jobs";
import { pollResource } from "./stages/polling/poll-resource";

export const jobPollerMock = async (jobsCollection: Collection<EnrichedJob>) => {
  console.log("🔄 Starting Mock Job Poller...");
  const provider = process.env.LLM_PROVIDER || "ollama";
  const model = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || "llama3";
  console.info(`[LLM] Mock job generation provider=${provider} model=${model}`);
  const generatedJobs = await pollResource();
  console.log(`✅ ${generatedJobs.length} mock jobs generated`);

  const apiKey = process.env.GEMINI_API_KEY;
  const embeddingModel = apiKey ? createEmbeddingClient(apiKey) : null;
  const enrichedJobs: EnrichedJob[] = await Promise.all(
    generatedJobs.map(async (job) => {
      const searchEmbedding = embeddingModel
        ? await createEmbedding(embeddingModel, job.searchableText).catch(() => [])
        : [];
      return {
        ...job,
        languages: [],
        frameworks: [],
        databases: [],
        platforms: [],
        tools: [],
        mustKnowSkills: job.requirements.slice(0, 8),
        niceToHaveSkills: [],
        searchEmbedding,
      };
    }),
  );

  await saveEnrichedJobs(jobsCollection, enrichedJobs);
  console.log(`✅ Mock job poller completed: ${enrichedJobs.length} jobs processed`);
  return enrichedJobs;
};
