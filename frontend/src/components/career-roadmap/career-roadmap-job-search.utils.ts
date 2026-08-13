import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';

export type DestinationJobResult = {
  id: string;
  jobTitle: string;
  company: string;
  seniority: string;
  url: string;
  matchPct?: number;
};

const parseJobs = (data: unknown): DestinationJobResult[] => {
  if (typeof data !== 'object' || data === null || !('jobs' in data) || !Array.isArray(data.jobs)) return [];
  return data.jobs.filter((item): item is DestinationJobResult => {
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

export const fetchJobsByTitle = async (userId: string, search: string): Promise<DestinationJobResult[]> => {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) return [];

  const params = new URLSearchParams({ userId, search: trimmedSearch });
  const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs?${params.toString()}`, {
    credentials: 'include',
  });

  if (!res.ok) return [];
  const data: unknown = await res.json().catch(() => []);
  return parseJobs(data);
};

export const saveDestinationToWishlist = async (userId: string, jobTitle: string): Promise<boolean> => {
  const trimmedTitle = jobTitle.trim();
  if (!trimmedTitle) return false;

  const keywords = [...new Set(trimmedTitle.toLowerCase().split(/\s+/).filter(Boolean))];
  const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/wanted-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      userId,
      jobTitle: trimmedTitle,
      keywords,
      rawText: `Roadmap destination search for ${trimmedTitle}`,
    }),
  });

  return res.ok;
};
