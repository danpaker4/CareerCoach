export type WantedJobStatus = "pending" | "matched" | "dismissed";

export type WantedJob = {
  id: string;
  userId: string;
  jobTitle: string;
  keywords: string[];
  location?: string;
  seniority?: string;
  rawText: string;
  embedding: number[];
  status: WantedJobStatus;
  matchedJobIds: string[];
  createdAt: Date;
  updatedAt: Date;
};
