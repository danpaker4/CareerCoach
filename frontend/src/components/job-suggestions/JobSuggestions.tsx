import { useState, useEffect, useCallback, useRef } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconBriefcase from '../../assets/icon-briefcase.svg';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import iconPlus from '../../assets/icon-plus.svg';
import iconMinus from '../../assets/icon-minus.svg';
import { UploadJobModal } from './UploadJobModal';
import { JobSuggestionsSkeleton } from './JobSuggestionsSkeleton';
import { JOB_SEARCH_DEBOUNCE_MS, JOBS_PREFETCH_ROOT_MARGIN } from './job-suggestions.consts';
import type {
  FetchState,
  JobResult,
  JobsRankingMode,
  LoadMoreState,
} from './job-suggestions.types';
import {
  buildJobsPageUrl,
  hashStringToNumber,
  mergeUniqueJobs,
  parseJobsPage,
  parsePipelineJobIdToEntryId,
} from './job-suggestions.utils';
import './JobSuggestions.css';
import type { User } from '../../types/user';

interface JobSuggestionsProps {
  user: User;
}


export const JobSuggestions = ({ user }: JobSuggestionsProps) => {
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [loadMoreState, setLoadMoreState] = useState<LoadMoreState>('idle');
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addingJob, setAddingJob] = useState<string | null>(null);
  const [pipelineJobIdToEntryId, setPipelineJobIdToEntryId] = useState(() => new Map<number, string>());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [rankingMode, setRankingMode] = useState<JobsRankingMode>('recent');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const loadMoreInFlightRef = useRef(false);

  const loadPipelineJobHashes = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${user.id}`, {
      credentials: 'include',
    });
    if (res.status === 404) {
      setPipelineJobIdToEntryId(new Map());
      return;
    }
    if (!res.ok) {
      return;
    }
    const data: unknown = await res.json().catch(() => []);
    setPipelineJobIdToEntryId(parsePipelineJobIdToEntryId(data));
  }, [user?.id]);

  const fetchJobs = useCallback(async (query: string, cursor: string | null = null): Promise<void> => {
    if (!user?.id) return;
    const isAppending = cursor !== null;
    if (isAppending && loadMoreInFlightRef.current) return;
    loadMoreInFlightRef.current = isAppending;
    requestAbortRef.current?.abort();
    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (isAppending) {
      setLoadMoreState('loading');
    } else {
      loadMoreInFlightRef.current = false;
      setFetchState('loading');
      setLoadMoreState('idle');
      setJobs([]);
      setNextCursor(null);
      setHasMore(false);
    }
    setErrorMessage('');

    try {
      const response = await apiFetch(buildJobsPageUrl(user.id, query, cursor), {
        credentials: 'include',
        signal: abortController.signal,
      });
      if (response.status === 409 && isAppending) {
        loadMoreInFlightRef.current = false;
        await fetchJobs(query);
        return;
      }
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data: unknown = await response.json();
      const parsedPage = parseJobsPage(data);
      if (!parsedPage) throw new Error('Server returned an invalid jobs response');
      if (requestId !== requestIdRef.current) return;

      setJobs((currentJobs) => isAppending ? mergeUniqueJobs(currentJobs, parsedPage.jobs) : parsedPage.jobs);
      setNextCursor(parsedPage.pagination.nextCursor);
      setHasMore(parsedPage.pagination.hasMore);
      setRankingMode(parsedPage.rankingMode);
      setFetchState('success');
      setLoadMoreState('idle');
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load jobs');
      if (isAppending) {
        setLoadMoreState('error');
        return;
      }
      setFetchState('error');
    } finally {
      if (isAppending && requestId === requestIdRef.current) {
        loadMoreInFlightRef.current = false;
      }
    }
  }, [user?.id]);

  useEffect(() => {
    void loadPipelineJobHashes();
  }, [loadPipelineJobHashes]);

  useEffect(() => {
    void fetchJobs('');
    return () => {
      requestAbortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchJobs]);

  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger || !hasMore || !nextCursor || loadMoreState !== 'idle' || fetchState !== 'success') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchJobs(searchQuery, nextCursor);
        }
      },
      { rootMargin: JOBS_PREFETCH_ROOT_MARGIN },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [fetchJobs, fetchState, hasMore, loadMoreState, nextCursor, searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchJobs(value);
    }, JOB_SEARCH_DEBOUNCE_MS);
  };

  const togglePipeline = async (job: JobResult) => {
    if (!user?.id) return;
    const numericId = hashStringToNumber(job.id);
    const existingEntryId = pipelineJobIdToEntryId.get(numericId);
    setAddingJob(job.id);
    try {
      if (existingEntryId) {
        const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${existingEntryId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok || res.status === 404) {
          setPipelineJobIdToEntryId((prev) => {
            const next = new Map(prev);
            next.delete(numericId);
            return next;
          });
        }
        return;
      }

      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          description: `${job.jobTitle} at ${job.company}`,
          jobStage: 'wishlist',
          jobId: numericId,
        }),
      });
      if (res.status === 201) {
        const created: unknown = await res.json().catch(() => null);
        if (
          typeof created === 'object' &&
          created !== null &&
          typeof (created as Record<string, unknown>).id === 'string'
        ) {
          const entryId = (created as Record<string, unknown>).id as string;
          setPipelineJobIdToEntryId((prev) => new Map(prev).set(numericId, entryId));
        } else {
          await loadPipelineJobHashes();
        }
        return;
      }
      if (res.status === 409) {
        await loadPipelineJobHashes();
      }
    } catch {
      // silently fail
    } finally {
      setAddingJob(null);
    }
  };

  return (
    <div className="jobs-page">
      <div className="jobs-container">

        <div className="jobs-header">
          <div>
            <h1 className="jobs-title">Job Suggestions</h1>
            <p className="jobs-subtitle">Jobs matched to your profile and skills</p>
          </div>
          <button
            type="button"
            className="btn-primary job-upload-btn"
            onClick={() => setShowUploadModal(true)}
          >
            <img src={iconPlus} alt="" aria-hidden="true" className="job-btn-icon job-btn-icon--white" />
            Upload Job
          </button>
        </div>

        <div className="jobs-search-bar">
          <input
            type="search"
            className="jobs-search-input"
            placeholder="Search by role, skill, or keyword"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search jobs"
          />
        </div>

        {fetchState === 'loading' && <JobSuggestionsSkeleton />}

        {fetchState === 'error' && (
          <div className="page-error">
            <p>Could not load jobs: {errorMessage}</p>
            <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={() => void fetchJobs(searchQuery)}>
              Try Again
            </button>
          </div>
        )}

        {fetchState === 'success' && (
          <>
            <p className="jobs-count">
              <strong>{jobs.length}</strong> {jobs.length === 1 ? 'job' : 'jobs'} loaded
            </p>

            {rankingMode === 'recent' && (
              <p className="jobs-ranking-notice">Personalized recommendations are being prepared. Showing recent jobs for now.</p>
            )}
            {rankingMode === 'query' && (
              <p className="jobs-ranking-notice">Your profile match is being prepared. Results are ranked by your search for now.</p>
            )}
            {rankingMode === 'keyword' && (
              <p className="jobs-ranking-notice">Semantic search is temporarily unavailable. Showing keyword matches.</p>
            )}

            {jobs.length === 0 && (
              <div className="jobs-empty surface-card">
                <img src={iconBriefcase} alt="" className="jobs-empty-icon" aria-hidden="true" />
                <h2>No jobs found</h2>
                <p>Try a different search term or check back later for new matches.</p>
              </div>
            )}

            {jobs.length > 0 && (
              <>
                <div className="jobs-grid">
                  {jobs.map((job) => {
                  const reqs = job.requirements ?? [];
                  const firstTwo = reqs.slice(0, 2);
                  const isAdding = addingJob === job.id;
                  const jobHash = hashStringToNumber(job.id);
                  const alreadyInPipeline = pipelineJobIdToEntryId.has(jobHash);
                  return (
                    <div key={job.id} className="job-card surface-card">
                      <div className="job-card-top">
                        <div className="job-card-info">
                          <h3 className="job-title">{job.jobTitle}</h3>
                          <p className="job-company">{job.company}</p>
                          <span className="badge badge-blue job-seniority">{job.seniority}</span>
                        </div>
                      </div>

                      {firstTwo.length > 0 && (
                        <div className="job-reqs">
                          {firstTwo.map((req) => (
                            <span key={req} className="job-req-chip">{req}</span>
                          ))}
                        </div>
                      )}

                      <div className="job-card-actions">
                        {job.url ? (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-outline job-view-btn"
                          >
                            <img src={iconArrowRight} alt="" aria-hidden="true" className="job-btn-icon" />
                            View Job
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className={`job-pipeline-btn${alreadyInPipeline ? ' job-pipeline-btn--in-pipeline' : ' btn-primary'}`}
                          onClick={() => togglePipeline(job)}
                          disabled={isAdding}
                          aria-label={alreadyInPipeline ? 'Remove from pipeline' : 'Add to pipeline'}
                        >
                          <img
                            src={alreadyInPipeline ? iconMinus : iconPlus}
                            alt=""
                            aria-hidden="true"
                            className={`job-btn-icon${alreadyInPipeline ? '' : ' job-btn-icon--white'}`}
                          />
                          {alreadyInPipeline ? (isAdding ? 'Removing...' : 'In pipeline') : isAdding ? 'Adding...' : 'Add to Pipeline'}
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>

                {(hasMore || loadMoreState !== 'idle') && (
                  <div ref={loadMoreTriggerRef} className="jobs-load-more" aria-live="polite">
                    {loadMoreState === 'loading' && <p>Loading more jobs…</p>}
                    {loadMoreState === 'error' && (
                      <>
                        <p>Could not load more jobs: {errorMessage}</p>
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => nextCursor && void fetchJobs(searchQuery, nextCursor)}
                        >
                          Try Again
                        </button>
                      </>
                    )}
                    {loadMoreState === 'idle' && hasMore && (
                      <button
                        type="button"
                        className="btn-outline jobs-load-more-button"
                        onClick={() => nextCursor && void fetchJobs(searchQuery, nextCursor)}
                      >
                        Load more jobs
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>

      {showUploadModal && (
        <UploadJobModal
          onClose={() => setShowUploadModal(false)}
          onCreated={() => {
            setShowUploadModal(false);
            void fetchJobs(searchQuery);
          }}
        />
      )}
    </div>
  );
};
