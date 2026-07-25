import { describe, expect, it } from 'vitest';
import type { JobResult } from './job-suggestions.types';
import {
  buildJobsPageUrl,
  mergeUniqueJobs,
  parseJobsPage,
} from './job-suggestions.utils';

const makeJob = (id: string): JobResult => ({
  id,
  jobTitle: `Job ${id}`,
  company: 'Example',
  seniority: 'mid',
  description: 'Example role',
  url: `https://example.test/jobs/${id}`,
});

describe('job suggestion utilities', () => {
  it('parses a valid paginated response', () => {
    const page = parseJobsPage({
      jobs: [makeJob('1')],
      pagination: {
        pageSize: 50,
        nextCursor: 'cursor-1',
        hasMore: true,
      },
      rankingMode: 'profile',
    });

    expect(page?.jobs.map((job) => job.id)).toEqual(['1']);
    expect(page?.pagination.nextCursor).toBe('cursor-1');
  });

  it('rejects the legacy array response', () => {
    expect(parseJobsPage([makeJob('1')])).toBeNull();
  });

  it('builds the first and continuation request URLs', () => {
    expect(buildJobsPageUrl('user-1', ' React ', null)).toContain('userId=user-1&search=React');
    expect(buildJobsPageUrl('user-1', '', 'cursor-1')).toContain('userId=user-1&cursor=cursor-1');
  });

  it('appends jobs without duplicating stable IDs', () => {
    const merged = mergeUniqueJobs([makeJob('1')], [makeJob('1'), makeJob('2')]);

    expect(merged.map((job) => job.id)).toEqual(['1', '2']);
  });
});
