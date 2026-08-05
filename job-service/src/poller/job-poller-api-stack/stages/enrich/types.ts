import type { AdaptedJob } from "../adapt/adapt-resource.types";

export type EnrichedJob = AdaptedJob & {
  salary: number;
  requirements: string[];
  benefits: string[];
  languages: string[];
  frameworks: string[];
  databases: string[];
  platforms: string[];
  tools: string[];
  mustKnowSkills: string[];
  niceToHaveSkills: string[];
  searchableText: string;
  searchEmbedding: number[];
  searchEmbeddingModel?: string;
  searchEmbeddingUpdatedAt?: Date;
  searchEmbeddingStatus?: "pending" | "ready" | "failed";
  createdAt?: Date;
  updatedAt?: Date;
};

export type GeminiExtract = {
  salary?: number | null;
  requirements?: string[];
  benefits?: string[];
  languages?: string[];
  frameworks?: string[];
  databases?: string[];
  platforms?: string[];
  tools?: string[];
  mustKnowSkills?: string[];
  niceToHaveSkills?: string[];
};
