import type { Collection } from "mongodb";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { WantedJob } from "./wanted-job.model";

export const DEFAULT_EMBEDDING_THRESHOLD = 0.7;
export const DEFAULT_KEYWORD_THRESHOLD = 0.5;
export const DEFAULT_MATCH_THRESHOLD = DEFAULT_EMBEDDING_THRESHOLD;

const BOILERPLATE_KEYWORDS = new Set([
  "entry level",
  "junior",
  "associate",
  "beginner-friendly",
  "adjacent",
  "related",
  "alternative",
  "adjacent roles",
]);

const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const buildJobBlob = (job: EnrichedJob): string =>
  [
    job.jobTitle,
    job.company,
    job.description,
    ...(job.requirements ?? []),
    ...(job.languages ?? []),
    ...(job.frameworks ?? []),
    ...(job.mustKnowSkills ?? []),
    ...(job.niceToHaveSkills ?? []),
  ]
    .join(" ")
    .toLowerCase();

const significantKeywordsFor = (wanted: WantedJob): string[] => {
  const fromTitle = wanted.jobTitle
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  const fromKeywords = wanted.keywords
    .map((kw) => kw.trim().toLowerCase())
    .filter((kw) => kw.length >= 3 && !BOILERPLATE_KEYWORDS.has(kw));
  const merged = [...fromTitle, ...fromKeywords];
  return Array.from(new Set(merged));
};

const keywordOverlapScore = (job: EnrichedJob, wanted: WantedJob): number => {
  const signals = significantKeywordsFor(wanted);
  if (signals.length === 0) return 0;
  const jobBlob = buildJobBlob(job);
  let hits = 0;
  for (const token of signals) {
    if (jobBlob.includes(token)) hits++;
  }
  return hits / signals.length;
};

export type WantedJobMatch = {
  wantedJob: WantedJob;
  score: number;
  method: "embedding" | "keywords";
};

export const findMatchingWantedJobs = async (
  job: EnrichedJob,
  wantedJobsCollection: Collection<WantedJob>,
  thresholds: { embedding?: number; keyword?: number } = {}
): Promise<WantedJobMatch[]> => {
  const pending = await wantedJobsCollection.find({ status: "pending" }).toArray();
  if (pending.length === 0) return [];

  const embeddingThreshold = thresholds.embedding ?? DEFAULT_EMBEDDING_THRESHOLD;
  const keywordThreshold = thresholds.keyword ?? DEFAULT_KEYWORD_THRESHOLD;
  const jobEmbedding = job.searchEmbedding ?? [];
  const matches: WantedJobMatch[] = [];

  for (const wanted of pending) {
    if (wanted.matchedJobIds.includes(job.id)) continue;
    if (jobEmbedding.length > 0 && wanted.embedding.length === jobEmbedding.length) {
      const score = cosineSimilarity(jobEmbedding, wanted.embedding);
      if (score >= embeddingThreshold) {
        matches.push({ wantedJob: wanted, score, method: "embedding" });
        continue;
      }
    }
    const score = keywordOverlapScore(job, wanted);
    if (score >= keywordThreshold) {
      matches.push({ wantedJob: wanted, score, method: "keywords" });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
};

export const markWantedJobMatched = async (
  wantedJobsCollection: Collection<WantedJob>,
  wantedJobId: string,
  newJobId: string
): Promise<void> => {
  await wantedJobsCollection.updateOne(
    { id: wantedJobId },
    {
      $set: { status: "matched", updatedAt: new Date() },
      $addToSet: { matchedJobIds: newJobId },
    }
  );
};
