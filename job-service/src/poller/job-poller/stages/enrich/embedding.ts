import { GoogleGenerativeAI } from "@google/generative-ai";

const EMBEDDING_MODEL = "text-embedding-004";

const normalizeList = (items: readonly string[]): string =>
  items.map((item) => item.trim()).filter(Boolean).join(", ");

export const buildSearchableText = (input: {
  jobTitle: string;
  description: string;
  requirements: readonly string[];
  benefits: readonly string[];
}): string => [
  `Job title: ${input.jobTitle}`,
  `Description: ${input.description}`,
  `Requirements: ${normalizeList(input.requirements)}`,
  `Benefits: ${normalizeList(input.benefits)}`,
].join("\n");

export const createEmbeddingClient = (apiKey: string) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
};

export const createEmbedding = async (
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  text: string,
): Promise<number[]> => {
  const result = await model.embedContent(text);
  const values = result.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error("Embedding model returned invalid vector");
  }
  return values;
};
