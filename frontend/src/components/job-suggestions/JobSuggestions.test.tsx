import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../types/user';
import { apiFetch } from '../../lib/apiClient';
import { JobSuggestions } from './JobSuggestions';

vi.mock('../../lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);
const TEST_USER: User = {
  id: '29ea44c8-6583-484f-a83e-bf7efaa6471d',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.test',
  role: 'user',
};

const makePage = (id: string, nextCursor: string | null, hasMore: boolean) => ({
  jobs: [{
    id,
    jobTitle: `Job ${id}`,
    company: 'Example',
    seniority: 'mid',
    description: 'Example role',
    url: `https://example.test/jobs/${id}`,
  }],
  pagination: {
    pageSize: 50,
    nextCursor,
    hasMore,
  },
  rankingMode: 'profile',
});

class IntersectionObserverMock implements IntersectionObserver {
  static callback: IntersectionObserverCallback | null = null;
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [0];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    IntersectionObserverMock.callback = callback;
  }
}

describe('JobSuggestions infinite loading', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    IntersectionObserverMock.callback = null;
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    mockApiFetch.mockImplementation(async (url) => {
      if (url.includes('/jobs-in-pipeline/')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes('cursor=cursor-1')) {
        return new Response(JSON.stringify(makePage('2', null, false)), { status: 200 });
      }
      return new Response(JSON.stringify(makePage('1', 'cursor-1', true)), { status: 200 });
    });
  });

  it('loads the next cursor page when the sentinel intersects', async () => {
    render(<JobSuggestions user={TEST_USER} />);

    expect(await screen.findByText('Job 1')).toBeTruthy();
    await waitFor(() => expect(IntersectionObserverMock.callback).not.toBeNull());

    await act(async () => {
      IntersectionObserverMock.callback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(await screen.findByText('Job 2')).toBeTruthy();
    expect(screen.getByText('Job 1')).toBeTruthy();
    expect(mockApiFetch.mock.calls.some(([url]) => url.includes('cursor=cursor-1'))).toBe(true);
  });
});
