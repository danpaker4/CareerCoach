import { GoogleGenerativeAI } from "@google/generative-ai";
import { getJobEmbeddingConfig } from "../../../../ai/job-embedding.config";
import { runEmbeddingRequestWithRetry } from "../../../../ai/embedding-retry.utils";
import { createLangfuseContentAttributes } from "../../../../observability/langfuse-observability.utils";
import { withSpan } from "../../../../observability/tracing";

export type EmbeddingClient = {
  genAI: GoogleGenerativeAI;
  modelName: string;
  dimensions: number;
};

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
  const config = getJobEmbeddingConfig();
  const genAI = new GoogleGenerativeAI(apiKey);
  return {
    genAI,
    modelName: config.JOB_EMBEDDING_MODEL,
    dimensions: config.JOB_EMBEDDING_DIMENSIONS,
  };
};

export const createEmbedding = async (
  client: EmbeddingClient,
  text: string,
): Promise<number[]> => {
  const values = await runEmbeddingRequestWithRetry(
    () => withSpan("llm.embedding", {
      "llm.provider": "gemini",
      "llm.model": client.modelName,
      "llm.operation": "job.embedding",
    }, async (span) => {
      const model = client.genAI.getGenerativeModel({ model: client.modelName });
      const result = await model.embedContent(text);
      const embeddingValues = result.embedding?.values;
      span.setAttribute("llm.request.status", Array.isArray(embeddingValues) ? "success" : "error");
      if (Array.isArray(embeddingValues)) {
        span.setAttribute("langfuse.observation.metadata.embedding_dimensions", String(embeddingValues.length));
      }
      span.setAttributes(createLangfuseContentAttributes(text));
      return embeddingValues;
    }),
  );
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`Embedding model ${client.modelName} returned an empty vector`);
  }
  if (values.length !== client.dimensions) {
    throw new Error(
      `Job embedding dimension ${values.length} does not match configured dimension ${client.dimensions}`,
    );
  }
  return values;
};
