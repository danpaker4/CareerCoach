import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './apiClient';

describe('apiFetch GET request coalescing', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('keeps a shared GET alive when one subscriber aborts', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      return new Promise<Response>((resolve, reject) => {
        const rejectAsAborted = () => reject(new DOMException('The operation was aborted', 'AbortError'));
        init?.signal?.addEventListener('abort', rejectAsAborted, { once: true });
        queueMicrotask(() => resolve(new Response(JSON.stringify({ jobs: [] }), { status: 200 })));
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstController = new AbortController();
    const secondController = new AbortController();
    const firstRequest = apiFetch('/jobs?userId=test-user', { signal: firstController.signal });
    const firstRequestExpectation = expect(firstRequest).rejects.toMatchObject({ name: 'AbortError' });

    firstController.abort();
    const secondRequest = apiFetch('/jobs?userId=test-user', { signal: secondController.signal });

    await firstRequestExpectation;
    const secondResponse = await secondRequest;

    expect(secondResponse.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });
});
