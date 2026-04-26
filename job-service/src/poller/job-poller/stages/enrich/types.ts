import type { AdaptedJob } from "../adapt/adapt-resource.types";

export type EnrichedJob = AdaptedJob & {
  salary: number;
  requirements: string[];
  benefits: string[];
  searchableText: string;
  searchEmbedding: number[];
};

export type GeminiExtract = {
  salary?: number;
  requirements?: string[];
  benefits?: string[];
};
