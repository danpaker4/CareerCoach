import { useCallback, useEffect, useState } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconTarget from '../../assets/icon-target.svg';
import iconX from '../../assets/icon-x.svg';
import './WantedJobsList.css';

interface WantedJobsListProps {
  userId: string;
}

interface WantedJob {
  id: string;
  userId: string;
  jobTitle: string;
  keywords: string[];
  location?: string;
  seniority?: string;
  rawText: string;
  status: 'pending' | 'matched' | 'dismissed';
  matchedJobIds: string[];
  createdAt: string;
  updatedAt: string;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const parseWantedJobs = (data: unknown): WantedJob[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is WantedJob => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.userId === 'string' &&
      typeof obj.jobTitle === 'string' &&
      Array.isArray(obj.keywords) &&
      typeof obj.status === 'string'
    );
  });
};

const formatRelativeDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const day = 86_400_000;
  if (diffMs < day) return 'today';
  if (diffMs < 2 * day) return 'yesterday';
  return date.toLocaleDateString();
};

export const WantedJobsList = ({ userId }: WantedJobsListProps) => {
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [items, setItems] = useState<WantedJob[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setFetchState('loading');
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/wanted-jobs/${userId}`, {
        credentials: 'include',
      });
      if (res.status === 404) {
        setItems([]);
        setFetchState('success');
        return;
      }
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: unknown = await res.json();
      setItems(parseWantedJobs(data));
      setFetchState('success');
    } catch {
      setFetchState('error');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    setRemovingId(id);
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/wanted-jobs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok || res.status === 404) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="wanted-jobs-section surface-card">
      <div className="form-section-header">
        <img src={iconTarget} alt="" aria-hidden="true" className="form-section-icon" />
        <h3 className="form-section-title">My Wanted Jobs</h3>
      </div>
      <p className="wanted-jobs-hint">
        Roles you've asked about that we haven't found yet. We'll alert you when one is added.
      </p>

      {fetchState === 'loading' && <p className="wanted-jobs-state">Loading…</p>}
      {fetchState === 'error' && (
        <div className="wanted-jobs-state wanted-jobs-state--error">
          Could not load your wanted jobs.
          <button type="button" className="btn-outline wanted-jobs-retry" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {fetchState === 'success' && items.length === 0 && (
        <p className="wanted-jobs-state">
          No wanted jobs yet. Ask the AI coach about a role we don't have, and we'll save it here.
        </p>
      )}

      {fetchState === 'success' && items.length > 0 && (
        <ul className="wanted-jobs-list">
          {items.map((item) => {
            const isRemoving = removingId === item.id;
            return (
              <li key={item.id} className="wanted-job-row">
                <div className="wanted-job-info">
                  <div className="wanted-job-title-row">
                    <h4 className="wanted-job-title">{item.jobTitle}</h4>
                    <span className={`wanted-job-status wanted-job-status--${item.status}`}>{item.status}</span>
                  </div>
                  {item.keywords.length > 0 && (
                    <div className="wanted-job-keywords">
                      {item.keywords.slice(0, 6).map((kw) => (
                        <span key={kw} className="wanted-job-chip">{kw}</span>
                      ))}
                    </div>
                  )}
                  <div className="wanted-job-meta">
                    {item.seniority && <span>{item.seniority}</span>}
                    {item.location && <span>· {item.location}</span>}
                    <span>· saved {formatRelativeDate(item.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="wanted-job-remove"
                  onClick={() => void handleDelete(item.id)}
                  disabled={isRemoving}
                  aria-label={`Remove ${item.jobTitle}`}
                  title="Remove"
                >
                  <img src={iconX} alt="" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
