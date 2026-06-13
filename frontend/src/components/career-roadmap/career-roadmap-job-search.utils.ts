import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';

const MIN_MATCH_FIT_PCT = 80;

export type DestinationJobResult = {
  id: string;
  jobTitle: string;
  company: string;
  seniority: string;
  url: string;
  matchPct?: number;
};

const parseJobs = (data: unknown): DestinationJobResult[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is DestinationJobResult => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.jobTitle === 'string' &&
      typeof obj.company === 'string' &&
      typeof obj.seniority === 'string' &&
      typeof obj.url === 'string'
    );
  });
};

const filterByMatchFit = (jobs: DestinationJobResult[]): DestinationJobResult[] => {
  const hasMatchScores = jobs.some((job) => job.matchPct !== undefined);
  return hasMatchScores
    ? jobs.filter((job) => (job.matchPct ?? 0) >= MIN_MATCH_FIT_PCT)
    : jobs;
};

export const fetchJobsByTitle = async (userId: string, search: string): Promise<DestinationJobResult[]> => {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) return [];

  const params = new URLSearchParams({ userId, search: trimmedSearch });
  const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs?${params.toString()}`, {
    credentials: 'include',
  });

  if (!res.ok) return [];
  const data: unknown = await res.json().catch(() => []);
  return filterByMatchFit(parseJobs(data));
};
