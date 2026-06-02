import type { Collection } from "mongodb";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { WantedJob } from "./wanted-job.model";

export const DEFAULT_MATCH_THRESHOLD = 0.7;

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

const keywordOverlapScore = (job: EnrichedJob, wanted: WantedJob): number => {
  if (wanted.keywords.length === 0) return 0;
  const jobBlob = [
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
  let hits = 0;
  for (const keyword of wanted.keywords) {
    if (keyword.trim().length < 2) continue;
    if (jobBlob.includes(keyword.toLowerCase())) hits++;
  }
  return hits / wanted.keywords.length;
};

export type WantedJobMatch = {
  wantedJob: WantedJob;
  score: number;
  method: "embedding" | "keywords";
};

export const findMatchingWantedJobs = async (
  job: EnrichedJob,
  wantedJobsCollection: Collection<WantedJob>,
  threshold: number = DEFAULT_MATCH_THRESHOLD
): Promise<WantedJobMatch[]> => {
  const pending = await wantedJobsCollection.find({ status: "pending" }).toArray();
  if (pending.length === 0) return [];

  const jobEmbedding = job.searchEmbedding ?? [];
  const matches: WantedJobMatch[] = [];

  for (const wanted of pending) {
    if (wanted.matchedJobIds.includes(job.id)) continue;
    let score = 0;
    let method: "embedding" | "keywords" = "keywords";
    if (jobEmbedding.length > 0 && wanted.embedding.length === jobEmbedding.length) {
      score = cosineSimilarity(jobEmbedding, wanted.embedding);
      method = "embedding";
    } else {
      score = keywordOverlapScore(job, wanted);
      method = "keywords";
    }
    if (score >= threshold) {
      matches.push({ wantedJob: wanted, score, method });
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
