export interface JobResult {
  id: string;
  jobTitle: string;
  company: string;
  seniority: string;
  description: string;
  url: string;
  salary?: number;
  requirements?: string[];
  benefits?: string[];
  matchPct?: number;
}

export type JobsRankingMode = 'profile' | 'profile_query' | 'query' | 'recent' | 'keyword';
export type FetchState = 'idle' | 'loading' | 'success' | 'error';
export type LoadMoreState = 'idle' | 'loading' | 'error';

export interface JobsPage {
  jobs: JobResult[];
  pagination: {
    pageSize: 50;
    nextCursor: string | null;
    hasMore: boolean;
  };
  rankingMode: JobsRankingMode;
}
