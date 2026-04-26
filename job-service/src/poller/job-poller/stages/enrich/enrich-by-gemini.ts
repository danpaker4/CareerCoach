import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AdaptedJob } from "../adapt/adapt-resource.types";
import type { EnrichedJob } from "./types";
import { buildEnrichmentPrompt } from "./prompet";
import { inferFallback } from "./fallback/fallback-logic";
import { cleanStringArray, parseGeminiJson } from "./utils/gemini-response-utils";
import { buildSearchableText, createEmbedding, createEmbeddingClient } from "./embedding";

const MAX_GEMINI_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const shouldRetryGeminiError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("503") || message.toLowerCase().includes("service unavailable");
};

const enrichSingleJob = async (
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  embeddingModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null,
  job: AdaptedJob,
  attempt = 1,
): Promise<EnrichedJob> => {
  if (!job.description.trim()) {
    const fallback = inferFallback(job);
    const searchableText = buildSearchableText({
      jobTitle: job.jobTitle,
      description: job.description,
      requirements: fallback.requirements,
      benefits: fallback.benefits,
    });
    const searchEmbedding = embeddingModel
      ? await createEmbedding(embeddingModel, searchableText).catch(() => [])
      : [];
    return { ...job, ...fallback, searchableText, searchEmbedding };
  }

  const prompt = buildEnrichmentPrompt(job);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseGeminiJson(text);
    const fallback = inferFallback(job);
    if (!parsed) {
      const searchableText = buildSearchableText({
        jobTitle: job.jobTitle,
        description: job.description,
        requirements: fallback.requirements,
        benefits: fallback.benefits,
      });
      const searchEmbedding = embeddingModel
        ? await createEmbedding(embeddingModel, searchableText).catch(() => [])
        : [];
      return { ...job, ...fallback, searchableText, searchEmbedding };
    }

    const salary = typeof parsed.salary === "number" ? parsed.salary : fallback.salary;
    const requirements = cleanStringArray(parsed.requirements);
    const benefits = cleanStringArray(parsed.benefits);
    const finalRequirements = requirements.length > 0 ? requirements : fallback.requirements;
    const finalBenefits = benefits.length > 0 ? benefits : fallback.benefits;
    const searchableText = buildSearchableText({
      jobTitle: job.jobTitle,
      description: job.description,
      requirements: finalRequirements,
      benefits: finalBenefits,
    });
    const searchEmbedding = embeddingModel
      ? await createEmbedding(embeddingModel, searchableText).catch(() => [])
      : [];

    return {
      ...job,
      salary,
      requirements: finalRequirements,
      benefits: finalBenefits,
      searchableText,
      searchEmbedding,
    };
  } catch (error) {
    const canRetry = shouldRetryGeminiError(error) && attempt < MAX_GEMINI_RETRIES;
    if (canRetry) {
      const delay = RETRY_BASE_DELAY_MS * attempt;
      console.warn(
        `Gemini request failed with service unavailability for job ${job.id}. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_GEMINI_RETRIES})`,
      );
      await sleep(delay);
      return enrichSingleJob(model, embeddingModel, job, attempt + 1);
    }

    console.warn(`Gemini enrichment failed for job ${job.id}. Using fallback values.`);
    const fallback = inferFallback(job);
    const searchableText = buildSearchableText({
      jobTitle: job.jobTitle,
      description: job.description,
      requirements: fallback.requirements,
      benefits: fallback.benefits,
    });
    const searchEmbedding = embeddingModel
      ? await createEmbedding(embeddingModel, searchableText).catch(() => [])
      : [];
    return { ...job, ...fallback, searchableText, searchEmbedding };
  }
};

export const enrichByGemini = async (jobs: AdaptedJob[]): Promise<EnrichedJob[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jobs.map((job) => {
      const fallback = inferFallback(job);
      const searchableText = buildSearchableText({
        jobTitle: job.jobTitle,
        description: job.description,
        requirements: fallback.requirements,
        benefits: fallback.benefits,
      });
      return { ...job, ...fallback, searchableText, searchEmbedding: [] };
    });
  }

  const modelName = process.env.LLM_MODEL || "gemini-3.1-flash-lite-preview";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const embeddingModel = createEmbeddingClient(apiKey);

  return Promise.all(jobs.map((job) => enrichSingleJob(model, embeddingModel, job)));
};
