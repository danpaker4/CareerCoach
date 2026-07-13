import { GoogleGenerativeAI } from "@google/generative-ai";
import { embedText as embedWithOllama, isOllamaEmbeddingProvider } from "../../../../ai/college-llm.client";
import { withSpan } from "../../../../observability/tracing";

const DEFAULT_EMBEDDING_MODELS = ["text-embedding-004", "gemini-embedding-001", "embedding-001"] as const;

export type EmbeddingClient =
  | {
    provider: "gemini";
    genAI: GoogleGenerativeAI;
    modelNames: string[];
  }
  | { provider: "ollama" };

const normalizeList = (items: readonly string[]): string =>
  items.map((item) => item.trim()).filter(Boolean).join(", ");

export const buildSearchableText = (input: {
  jobTitle: string;
  description: string;
  requirements: readonly string[];
  benefits: readonly string[];
  languages: readonly string[];
  frameworks: readonly string[];
  databases: readonly string[];
  platforms: readonly string[];
  tools: readonly string[];
  mustKnowSkills: readonly string[];
  niceToHaveSkills: readonly string[];
}): string => [
  `Job title: ${input.jobTitle}`,
  `Description: ${input.description}`,
  `Requirements: ${normalizeList(input.requirements)}`,
  `Benefits: ${normalizeList(input.benefits)}`,
  `Languages: ${normalizeList(input.languages)}`,
  `Frameworks: ${normalizeList(input.frameworks)}`,
  `Databases: ${normalizeList(input.databases)}`,
  `Platforms: ${normalizeList(input.platforms)}`,
  `Tools: ${normalizeList(input.tools)}`,
  `Must know skills: ${normalizeList(input.mustKnowSkills)}`,
  `Nice to have skills: ${normalizeList(input.niceToHaveSkills)}`,
].join("\n");

export const createEmbeddingClient = (apiKey: string): EmbeddingClient => {
  const preferredModel = process.env.JOB_EMBEDDING_MODEL;
  const modelNames = [
    ...(preferredModel ? [preferredModel] : []),
    ...DEFAULT_EMBEDDING_MODELS,
  ].filter((name, index, arr) => arr.indexOf(name) === index);
  const genAI = new GoogleGenerativeAI(apiKey);
  return { provider: "gemini", genAI, modelNames };
};

export const createEmbeddingClientFromEnv = (): EmbeddingClient | null => {
  if (isOllamaEmbeddingProvider()) {
    return { provider: "ollama" };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? createEmbeddingClient(apiKey) : null;
};

export const createEmbedding = async (
  client: EmbeddingClient,
  text: string,
): Promise<number[]> => {
  if (client.provider === "ollama") {
    return await withSpan("llm.embedding", {
      "llm.provider": "ollama",
      "llm.model": process.env.EMBEDDING_MODEL || "all-minilm:latest",
      "llm.operation": "job.embedding",
    }, async (span) => {
      const values = await embedWithOllama(text);
      span.setAttribute("llm.request.status", values.length > 0 ? "success" : "error");
      return values;
    });
  }
  let lastError: unknown = null;
  for (const modelName of client.modelNames) {
    try {
      const values = await withSpan("llm.embedding", {
        "llm.provider": "gemini",
        "llm.model": modelName,
        "llm.operation": "job.embedding",
      }, async (span) => {
        const model = client.genAI.getGenerativeModel({ model: modelName });
        const result = await model.embedContent(text);
        const embeddingValues = result.embedding?.values;
        span.setAttribute("llm.request.status", Array.isArray(embeddingValues) ? "success" : "error");
        return embeddingValues;
      });
      if (Array.isArray(values)) {
        return values;
      }
      lastError = new Error(`Embedding model ${modelName} returned invalid vector`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("All embedding models failed");
};
