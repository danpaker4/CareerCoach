import { useState, useEffect, useCallback, useRef } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconBriefcase from '../../assets/icon-briefcase.svg';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import iconPlus from '../../assets/icon-plus.svg';
import iconMinus from '../../assets/icon-minus.svg';
import { UploadJobModal } from './UploadJobModal';
import { AiAnalysisLoader } from './AiAnalysisLoader';
import './JobSuggestions.css';
import type { User } from '../../types/user';

interface JobResult {
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

interface JobSuggestionsProps {
  user: User;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const hashStringToNumber = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const parseJobs = (data: unknown): JobResult[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is JobResult => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.jobTitle === 'string' &&
      typeof obj.company === 'string' &&
      typeof obj.seniority === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.url === 'string'
    );
  });
};

const matchColor = (pct: number): string => {
  if (pct >= 75) return 'match-ring--green';
  if (pct >= 40) return 'match-ring--yellow';
  return 'match-ring--red';
};

const MatchRing = ({ pct }: { pct: number }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const colorClass = matchColor(pct);
  const strokeColor =
    pct >= 75 ? 'var(--clr-success)' : pct >= 40 ? 'var(--clr-warning)' : 'var(--clr-error)';

  return (
    <svg
      className={`match-ring-svg ${colorClass}`}
      viewBox="0 0 70 70"
      width="70"
      height="70"
      aria-label={`${pct}% match`}
    >
      <circle cx="35" cy="35" r={radius} fill="none" stroke="var(--clr-slate-200)" strokeWidth="6" />
      <circle
        cx="35" cy="35" r={radius} fill="none"
        stroke={strokeColor} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform="rotate(-90 35 35)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="35" y="31" textAnchor="middle" fontSize="13" fontWeight="800" fill={strokeColor}>{pct}%</text>
      <text x="35" y="44" textAnchor="middle" fontSize="8" fill="var(--clr-slate-500)">match</text>
    </svg>
  );
};

const parsePipelineJobIdToEntryId = (data: unknown): Map<number, string> => {
  if (!Array.isArray(data)) {
    return new Map();
  }
  const map = new Map<number, string>();
  data.forEach((item) => {
    if (typeof item !== 'object' || item === null) {
      return;
    }
    const obj = item as Record<string, unknown>;
    const jobId = obj.jobId;
    const entryId = obj.id;
    if (typeof jobId === 'number' && typeof entryId === 'string') {
      map.set(jobId, entryId);
    }
  });
  return map;
};

export const JobSuggestions = ({ user }: JobSuggestionsProps) => {
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [pendingJobs, setPendingJobs] = useState<JobResult[] | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addingJob, setAddingJob] = useState<string | null>(null);
  const [pipelineJobIdToEntryId, setPipelineJobIdToEntryId] = useState(() => new Map<number, string>());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchJobs = useCallback((query: string) => {
    if (!user?.id) return;
    setPendingJobs(null);
    setFetchState('loading');
    const url = query.trim()
      ? `${ENV.JOB_SERVICE_BASE_URL}/jobs?userId=${user.id}&search=${encodeURIComponent(query.trim())}`
      : `${ENV.JOB_SERVICE_BASE_URL}/jobs?userId=${user.id}`;
    apiFetch(url, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 404) { setPendingJobs([]); return; }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data: unknown = await res.json();
        setPendingJobs(parseJobs(data));
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load jobs');
        setFetchState('error');
      });
  }, [user?.id]);

  const handleAnalysisComplete = useCallback(() => {
    if (pendingJobs !== null) {
      setJobs(pendingJobs);
      setPendingJobs(null);
      setFetchState('success');
    }
  }, [pendingJobs]);

  useEffect(() => {
    void loadPipelineJobHashes();
  }, [loadPipelineJobHashes]);

  useEffect(() => {
    fetchJobs('');
  }, [fetchJobs]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchJobs(value);
    }, 400);
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
            placeholder="Search jobs, companies, skills..."
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search jobs"
          />
        </div>

        {fetchState === 'loading' && (
          <AiAnalysisLoader
            isDataReady={pendingJobs !== null}
            onComplete={handleAnalysisComplete}
          />
        )}

        {fetchState === 'error' && (
          <div className="page-error">
            <p>Could not load jobs: {errorMessage}</p>
            <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={() => fetchJobs(searchQuery)}>
              Try Again
            </button>
          </div>
        )}

        {fetchState === 'success' && (
          <>
            <p className="jobs-count">
              <strong>{jobs.length}</strong> {jobs.length === 1 ? 'job' : 'jobs'} found
            </p>

            {jobs.length === 0 && (
              <div className="jobs-empty surface-card">
                <img src={iconBriefcase} alt="" className="jobs-empty-icon" aria-hidden="true" />
                <h2>No jobs found</h2>
                <p>Try a different search term or check back later for new matches.</p>
              </div>
            )}

            {jobs.length > 0 && (
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
                        {job.matchPct !== undefined && (
                          <div className="job-match-ring">
                            <MatchRing pct={job.matchPct} />
                          </div>
                        )}
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
            )}
          </>
        )}

      </div>

      {showUploadModal && (
        <UploadJobModal
          onClose={() => setShowUploadModal(false)}
          onCreated={() => {
            setShowUploadModal(false);
            fetchJobs(searchQuery);
          }}
        />
      )}
    </div>
  );
};
