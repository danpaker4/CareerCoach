import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AdaptedJob } from "../adapt/adapt-resource.types";
import type { EnrichedJob } from "./types";
import { buildEnrichmentPrompt } from "./prompet";
import { inferFallback } from "./fallback/fallback-logic";
import { cleanStringArray, parseGeminiJson } from "./utils/gemini-response-utils";

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
  job: AdaptedJob,
): Promise<EnrichedJob> => {
  if (!job.description.trim()) {
    return { ...job, ...inferFallback(job) };
  }

  const prompt = buildEnrichmentPrompt(job);

  for (let attempt = 1; attempt <= MAX_GEMINI_RETRIES; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseGeminiJson(text);
      if (!parsed) {
        return { ...job, ...inferFallback(job) };
      }

      const salary = parsed.salary as number;
      const requirements = cleanStringArray(parsed.requirements);
      const benefits = cleanStringArray(parsed.benefits);

      const fallback = inferFallback(job);
      return {
        ...job,
        salary,
        requirements: requirements.length > 0 ? requirements : fallback.requirements,
        benefits: benefits.length > 0 ? benefits : fallback.benefits,
      };
    } catch (error) {
      const canRetry = shouldRetryGeminiError(error) && attempt < MAX_GEMINI_RETRIES;
      if (canRetry) {
        const delay = RETRY_BASE_DELAY_MS * attempt;
        console.warn(
          `Gemini request failed with service unavailability for job ${job.id}. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_GEMINI_RETRIES})`,
        );
        await sleep(delay);
        continue;
      }

      console.warn(`Gemini enrichment failed for job ${job.id}. Using fallback values.`);
      return { ...job, ...inferFallback(job) };
    }
  }

  return { ...job, ...inferFallback(job) };
};

export const enrichByGemini = async (jobs: AdaptedJob[]): Promise<EnrichedJob[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jobs.map((job) => ({ ...job, ...inferFallback(job) }));
  }

  const modelName = process.env.LLM_MODEL || "gemini-3.1-flash-lite-preview";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const enrichedJobs: EnrichedJob[] = [];
  for (const job of jobs) {
    enrichedJobs.push(await enrichSingleJob(model, job));
  }

  return enrichedJobs;
};
