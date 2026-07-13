import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LlmTokenUsageRecorder } from "../../../../llm-token-usage/llm-token-usage.types";
import { readGeminiUsage, readOllamaUsage, recordLlmTokenUsage } from "../../../../llm-token-usage/llm-token-usage.utils";
import { withSpan } from "../../../../observability/tracing";
import type { AdaptedJob } from "../adapt/adapt-resource.types";
import type { EnrichedJob } from "./types";
import { buildEnrichmentPrompt } from "./prompet";
import { inferFallback } from "./fallback/fallback-logic";
import { cleanStringArray, parseGeminiJson } from "./utils/gemini-response-utils";
import { buildSearchableText, createEmbedding, createEmbeddingClientFromEnv, type EmbeddingClient } from "./embedding";
import { buildLlmAuthHeaders } from "../../../../ai/llm-auth.utils";

const MAX_GEMINI_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_LLM_MODEL = "llama3";

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const normalizeTechnologyValue = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, string> = {
    node: "Node.js",
    nodejs: "Node.js",
    "node.js": "Node.js",
    mongo: "MongoDB",
    mongodb: "MongoDB",
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    k8s: "Kubernetes",
  };
  return map[normalized] ?? value.trim();
};

const normalizeArray = (items: readonly string[]): string[] =>
  [...new Set(items.map((item) => normalizeTechnologyValue(item)).filter((item) => item.length > 0))];

const shouldRetryGeminiError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("503")
    || message.includes("429")
    || message.toLowerCase().includes("service unavailable");
};

// 429 = the gateway's 10-requests/minute window is exhausted; retrying sooner is pointless.
const RATE_LIMIT_RETRY_DELAY_MS = 61_000;

const retryDelayForError = (error: unknown, attempt: number): number => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") ? RATE_LIMIT_RETRY_DELAY_MS : RETRY_BASE_DELAY_MS * attempt;
};

const generateWithOllama = async (
  prompt: string,
  modelName: string,
  tokenUsageRecorder?: LlmTokenUsageRecorder,
): Promise<string> => withSpan("llm.complete", {
  "llm.provider": "ollama",
  "llm.model": modelName,
  "llm.operation": "job.enrichment",
}, async (span) => {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildLlmAuthHeaders() },
    body: JSON.stringify({ model: modelName, prompt, stream: false }),
  });
  const payload: unknown = await response.json().catch(() => null);
  span.setAttribute("http.response.status_code", response.status);

  if (!response.ok || typeof payload !== "object" || payload === null || !("response" in payload)) {
    span.setAttribute("llm.request.status", "error");
    throw new Error(`Ollama enrichment failed with status ${response.status}`);
  }
  const text = (payload as { response?: unknown }).response;
  if (typeof text !== "string") {
    span.setAttribute("llm.request.status", "error");
    throw new Error("Ollama enrichment returned invalid response");
  }
  const usage = readOllamaUsage(payload);
  if (usage) {
    span.setAttribute("llm.usage.prompt_tokens", usage.promptTokens);
    span.setAttribute("llm.usage.completion_tokens", usage.completionTokens);
    span.setAttribute("llm.usage.total_tokens", usage.totalTokens);
  }
  await recordLlmTokenUsage(tokenUsageRecorder, {
    sourceService: "job-service",
    operation: "job.enrichment",
    provider: "ollama",
    model: modelName,
    usage,
  });
  span.setAttribute("llm.request.status", "success");
  return text;
});

const enrichSingleJob = async (
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  embeddingModel: EmbeddingClient | null,
  job: AdaptedJob,
  llmProvider: "gemini" | "ollama",
  llmModel: string,
  tokenUsageRecorder?: LlmTokenUsageRecorder,
  attempt = 1,
): Promise<EnrichedJob> => {
  if (!job.description.trim()) {
    const fallback = inferFallback(job);
    const searchableText = buildSearchableText({
      jobTitle: job.jobTitle,
      description: job.description,
      requirements: fallback.requirements,
      benefits: fallback.benefits,
      languages: fallback.languages,
      frameworks: fallback.frameworks,
      databases: fallback.databases,
      platforms: fallback.platforms,
      tools: fallback.tools,
      mustKnowSkills: fallback.mustKnowSkills,
      niceToHaveSkills: fallback.niceToHaveSkills,
    });
    const searchEmbedding = embeddingModel
      ? await createEmbedding(embeddingModel, searchableText).catch(() => [])
      : [];
    return { ...job, ...fallback, searchableText, searchEmbedding };
  }

  const prompt = buildEnrichmentPrompt(job);

  try {
    const text = llmProvider === "ollama"
      ? await generateWithOllama(prompt, llmModel, tokenUsageRecorder)
      : await (async (): Promise<string> => {
        return await withSpan("llm.complete", {
          "llm.provider": "gemini",
          "llm.model": llmModel,
          "llm.operation": "job.enrichment",
        }, async (span) => {
          const result = await model.generateContent(prompt);
          const usage = readGeminiUsage(result.response);
          if (usage) {
            span.setAttribute("llm.usage.prompt_tokens", usage.promptTokens);
            span.setAttribute("llm.usage.completion_tokens", usage.completionTokens);
            span.setAttribute("llm.usage.total_tokens", usage.totalTokens);
          }
          const generatedText = result.response.text();
          await recordLlmTokenUsage(tokenUsageRecorder, {
            sourceService: "job-service",
            operation: "job.enrichment",
            provider: "gemini",
            model: llmModel,
            usage,
          });
          span.setAttribute("llm.request.status", "success");
          return generatedText;
        });
      })();
    const parsed = parseGeminiJson(text);
    const fallback = inferFallback(job);
    if (!parsed) {
      const searchableText = buildSearchableText({
        jobTitle: job.jobTitle,
        description: job.description,
        requirements: fallback.requirements,
        benefits: fallback.benefits,
        languages: fallback.languages,
        frameworks: fallback.frameworks,
        databases: fallback.databases,
        platforms: fallback.platforms,
        tools: fallback.tools,
        mustKnowSkills: fallback.mustKnowSkills,
        niceToHaveSkills: fallback.niceToHaveSkills,
      });
      const searchEmbedding = embeddingModel
        ? await createEmbedding(embeddingModel, searchableText).catch(() => [])
        : [];
      return { ...job, ...fallback, searchableText, searchEmbedding };
    }

    const salary = typeof parsed.salary === "number" ? parsed.salary : fallback.salary;
    const requirements = cleanStringArray(parsed.requirements);
    const benefits = cleanStringArray(parsed.benefits);
    const languages = normalizeArray(cleanStringArray(parsed.languages));
    const frameworks = normalizeArray(cleanStringArray(parsed.frameworks));
    const databases = normalizeArray(cleanStringArray(parsed.databases));
    const platforms = normalizeArray(cleanStringArray(parsed.platforms));
    const tools = normalizeArray(cleanStringArray(parsed.tools));
    const mustKnowSkills = normalizeArray(cleanStringArray(parsed.mustKnowSkills));
    const niceToHaveSkills = normalizeArray(cleanStringArray(parsed.niceToHaveSkills));
    const finalRequirements = requirements.length > 0 ? requirements : fallback.requirements;
    const finalBenefits = benefits.length > 0 ? benefits : fallback.benefits;
    const finalLanguages = languages.length > 0 ? languages : fallback.languages;
    const finalFrameworks = frameworks.length > 0 ? frameworks : fallback.frameworks;
    const finalDatabases = databases.length > 0 ? databases : fallback.databases;
    const finalPlatforms = platforms.length > 0 ? platforms : fallback.platforms;
    const finalTools = tools.length > 0 ? tools : fallback.tools;
    const finalMustKnowSkills = mustKnowSkills.length > 0 ? mustKnowSkills : fallback.mustKnowSkills;
    const finalNiceToHaveSkills = niceToHaveSkills.length > 0 ? niceToHaveSkills : fallback.niceToHaveSkills;
    const searchableText = buildSearchableText({
      jobTitle: job.jobTitle,
      description: job.description,
      requirements: finalRequirements,
      benefits: finalBenefits,
      languages: finalLanguages,
      frameworks: finalFrameworks,
      databases: finalDatabases,
      platforms: finalPlatforms,
      tools: finalTools,
      mustKnowSkills: finalMustKnowSkills,
      niceToHaveSkills: finalNiceToHaveSkills,
    });
    const searchEmbedding = embeddingModel
      ? await createEmbedding(embeddingModel, searchableText).catch(() => [])
      : [];

    return {
      ...job,
      salary,
      requirements: finalRequirements,
      benefits: finalBenefits,
      languages: finalLanguages,
      frameworks: finalFrameworks,
      databases: finalDatabases,
      platforms: finalPlatforms,
      tools: finalTools,
      mustKnowSkills: finalMustKnowSkills,
      niceToHaveSkills: finalNiceToHaveSkills,
      searchableText,
      searchEmbedding,
    };
  } catch (error) {
    const canRetry = shouldRetryGeminiError(error) && attempt < MAX_GEMINI_RETRIES;
    if (canRetry) {
      const delay = retryDelayForError(error, attempt);
      console.warn(
        `LLM request failed (retryable) for job ${job.id}. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_GEMINI_RETRIES})`,
      );
      await sleep(delay);
      return enrichSingleJob(model, embeddingModel, job, llmProvider, llmModel, tokenUsageRecorder, attempt + 1);
    }

    console.warn(`Gemini enrichment failed for job ${job.id}. Using fallback values.`);
    const fallback = inferFallback(job);
    const searchableText = buildSearchableText({
      jobTitle: job.jobTitle,
      description: job.description,
      requirements: fallback.requirements,
      benefits: fallback.benefits,
      languages: fallback.languages,
      frameworks: fallback.frameworks,
      databases: fallback.databases,
      platforms: fallback.platforms,
      tools: fallback.tools,
      mustKnowSkills: fallback.mustKnowSkills,
      niceToHaveSkills: fallback.niceToHaveSkills,
    });
    const searchEmbedding = embeddingModel
      ? await createEmbedding(embeddingModel, searchableText).catch(() => [])
      : [];
    return { ...job, ...fallback, searchableText, searchEmbedding };
  }
};

export const enrichByGemini = async (
  jobs: AdaptedJob[],
  tokenUsageRecorder?: LlmTokenUsageRecorder,
): Promise<EnrichedJob[]> => {
  const llmProvider = (process.env.LLM_PROVIDER || "ollama").toLowerCase() === "gemini" ? "gemini" : "ollama";
  const llmModel = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || DEFAULT_LLM_MODEL;
  console.info(`[LLM] Job enrichment generator provider=${llmProvider} model=${llmModel}`);
  const apiKey = process.env.GEMINI_API_KEY;
  if (llmProvider === "gemini" && !apiKey) {
    return jobs.map((job) => {
      const fallback = inferFallback(job);
      const searchableText = buildSearchableText({
        jobTitle: job.jobTitle,
        description: job.description,
        requirements: fallback.requirements,
        benefits: fallback.benefits,
        languages: fallback.languages,
        frameworks: fallback.frameworks,
        databases: fallback.databases,
        platforms: fallback.platforms,
        tools: fallback.tools,
        mustKnowSkills: fallback.mustKnowSkills,
        niceToHaveSkills: fallback.niceToHaveSkills,
      });
      return { ...job, ...fallback, searchableText, searchEmbedding: [] };
    });
  }

  const model = llmProvider === "gemini" && apiKey
    ? new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: llmModel })
    : null;
  const embeddingModel = createEmbeddingClientFromEnv();

  // Sequential on purpose: the college LLM gateway allows ~10 generate-requests/minute
  // per IP. Enriching in parallel bursts the whole batch at once and everything 429s.
  const enrichedJobs: EnrichedJob[] = [];
  for (const job of jobs) {
    enrichedJobs.push(await enrichSingleJob(
      model as ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
      embeddingModel,
      job,
      llmProvider,
      llmModel,
      tokenUsageRecorder
    ));
  }
  return enrichedJobs;
};
