import type { WantedJob } from "./wanted-job.model";

export const buildWantedJobEmbeddingText = (input: {
  jobTitle: string;
  keywords: readonly string[];
  location?: string;
  seniority?: string;
  rawText?: string;
}): string => {
  const parts = [
    `Wanted role: ${input.jobTitle}`,
    `Keywords: ${input.keywords.join(", ")}`,
  ];
  if (input.seniority) parts.push(`Seniority: ${input.seniority}`);
  if (input.location) parts.push(`Location: ${input.location}`);
  if (input.rawText && input.rawText.trim().length > 0) {
    parts.push(`Original message: ${input.rawText.trim()}`);
  }
  return parts.join("\n");
};

export const serializeWantedJob = (doc: WantedJob) => ({
  id: doc.id,
  userId: doc.userId,
  jobTitle: doc.jobTitle,
  keywords: doc.keywords,
  location: doc.location ?? undefined,
  seniority: doc.seniority ?? undefined,
  rawText: doc.rawText,
  status: doc.status,
  matchedJobIds: doc.matchedJobIds,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});
