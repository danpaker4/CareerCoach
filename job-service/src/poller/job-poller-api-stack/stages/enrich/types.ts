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
};

export type GeminiExtract = {
  salary?: number;
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
