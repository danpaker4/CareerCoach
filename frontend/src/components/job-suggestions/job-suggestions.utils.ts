import { ENV } from '../../config';
import type { JobResult, JobsPage, JobsRankingMode } from './job-suggestions.types';

const RANKING_MODES: readonly JobsRankingMode[] = ['profile', 'profile_query', 'query', 'recent', 'keyword'];

const isJobResult = (value: unknown): value is JobResult => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.jobTitle === 'string' &&
    typeof item.company === 'string' &&
    typeof item.seniority === 'string' &&
    typeof item.description === 'string' &&
    typeof item.url === 'string'
  );
};

export const parseJobsPage = (data: unknown): JobsPage | null => {
  if (typeof data !== 'object' || data === null) return null;
  const payload = data as Record<string, unknown>;
  const pagination = payload.pagination;
  if (
    !Array.isArray(payload.jobs) ||
    typeof pagination !== 'object' ||
    pagination === null ||
    typeof payload.rankingMode !== 'string' ||
    !RANKING_MODES.includes(payload.rankingMode as JobsRankingMode)
  ) {
    return null;
  }

  const paginationRecord = pagination as Record<string, unknown>;
  if (
    paginationRecord.pageSize !== 50 ||
    (typeof paginationRecord.nextCursor !== 'string' && paginationRecord.nextCursor !== null) ||
    typeof paginationRecord.hasMore !== 'boolean'
  ) {
    return null;
  }

  return {
    jobs: payload.jobs.filter(isJobResult),
    pagination: {
      pageSize: 50,
      nextCursor: paginationRecord.nextCursor,
      hasMore: paginationRecord.hasMore,
    },
    rankingMode: payload.rankingMode as JobsRankingMode,
  };
};

export const buildJobsPageUrl = (userId: string, query: string, cursor: string | null): string => {
  const params = new URLSearchParams({ userId });
  const trimmedQuery = query.trim();
  if (trimmedQuery) params.set('search', trimmedQuery);
  if (cursor) params.set('cursor', cursor);
  return `${ENV.JOB_SERVICE_BASE_URL}/jobs?${params.toString()}`;
};

export const mergeUniqueJobs = (currentJobs: readonly JobResult[], nextJobs: readonly JobResult[]): JobResult[] => {
  const knownIds = new Set(currentJobs.map((job) => job.id));
  return [...currentJobs, ...nextJobs.filter((job) => !knownIds.has(job.id))];
};

export const hashStringToNumber = (value: string): number =>
  [...value].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0);

export const parsePipelineJobIdToEntryId = (data: unknown): Map<number, string> => {
  if (!Array.isArray(data)) return new Map();
  return data.reduce<Map<number, string>>((entries, item) => {
    if (typeof item !== 'object' || item === null) return entries;
    const record = item as Record<string, unknown>;
    if (typeof record.jobId !== 'number' || typeof record.id !== 'string') return entries;
    return new Map(entries).set(record.jobId, record.id);
  }, new Map());
};
