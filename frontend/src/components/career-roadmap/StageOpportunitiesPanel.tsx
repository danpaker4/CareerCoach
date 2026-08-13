import { useEffect, useId, useState } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { hashStringToNumber, parsePipelineJobIdToEntryId } from '../job-suggestions/job-suggestions.utils';
import { fetchStageOpportunities } from './career-roadmap-opportunities.utils';
import type { StageOpportunity, StageOpportunitiesResponse } from './career-roadmap.types';

type StageOpportunitiesPanelProps = {
  roleCategories: string[];
  userId: string;
  userSkills?: string[];
};

const EMPTY_PAGE: StageOpportunitiesResponse = {
  opportunities: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
};

const FILTER_SEPARATOR = '\u001f';

const OpportunityList = ({ title, items, expandedJobId, addingJobId, pipelineJobIds, onToggleDetails, onAddToPipeline }: {
  title: string;
  items: StageOpportunity[];
  expandedJobId: string | null;
  addingJobId: string | null;
  pipelineJobIds: ReadonlySet<number>;
  onToggleDetails: (jobId: string) => void;
  onAddToPipeline: (job: StageOpportunity) => void;
}) => {
  if (items.length === 0) return null;
  return (
    <section className="roadmap-jobs-group">
      <h4>{title} <span>{items.length}</span></h4>
      <ul className="roadmap-jobs-list">
        {items.map((item) => {
          const expanded = expandedJobId === item.jobId;
          const inPipeline = pipelineJobIds.has(hashStringToNumber(item.jobId));
          return (
            <li key={item.jobId} className="roadmap-job-card">
              <div className="roadmap-job-card-head">
                <div>
                  <h5>{item.title}</h5>
                  <p>{item.company} · {item.seniority || 'Seniority not specified'}</p>
                </div>
                <span className={`roadmap-job-fit roadmap-job-fit--${item.fit}`}>{item.fit === 'apply-now' ? 'Apply now' : 'Target job'}</span>
              </div>
              <p className="roadmap-job-reason">{item.relevanceReason}</p>
              {expanded && (
                <div className="roadmap-job-details">
                  {item.description && <p>{item.description}</p>}
                  {item.missingRequirements.length > 0 && (
                    <div>
                      <strong>Requirements to build</strong>
                      <ul>{item.missingRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
              <div className="roadmap-job-actions">
                <button type="button" onClick={() => onToggleDetails(item.jobId)}>{expanded ? 'Hide details' : 'See details'}</button>
                <button type="button" onClick={() => onAddToPipeline(item)} disabled={inPipeline || addingJobId === item.jobId}>
                  {inPipeline ? 'In my pipeline' : addingJobId === item.jobId ? 'Adding…' : 'Add to my pipeline'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export const StageOpportunitiesPanel = ({ roleCategories, userId, userSkills }: StageOpportunitiesPanelProps) => {
  const searchTitleInputId = useId();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<StageOpportunitiesResponse>(EMPTY_PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [editingAlert, setEditingAlert] = useState(false);
  const [seniority, setSeniority] = useState('');
  const [location, setLocation] = useState('');
  const [addingJobId, setAddingJobId] = useState<string | null>(null);
  const [pipelineJobIds, setPipelineJobIds] = useState<ReadonlySet<number>>(new Set());
  const [pipelineError, setPipelineError] = useState('');
  const primaryRole = roleCategories[0] ?? '';
  const [searchTitle, setSearchTitle] = useState(primaryRole);
  const [activeSearchTitle, setActiveSearchTitle] = useState(primaryRole);
  const roleCategoriesKey = activeSearchTitle;
  const userSkillsKey = (userSkills ?? []).join(FILTER_SEPARATOR);

  useEffect(() => {
    if (!open || roleCategoriesKey.length === 0) return;
    setLoading(true);
    setError('');
    fetchStageOpportunities(
      roleCategoriesKey.split(FILTER_SEPARATOR),
      userSkillsKey.length > 0 ? userSkillsKey.split(FILTER_SEPARATOR) : undefined,
      page
    )
      .then(setResult)
      .catch(() => setError('Could not load jobs for this roadmap stage.'))
      .finally(() => setLoading(false));
  }, [open, page, roleCategoriesKey, userSkillsKey]);

  useEffect(() => {
    if (!open) return;
    apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${userId}`, { credentials: 'include' })
      .then(async (response) => response.status === 404 ? [] : response.ok ? response.json() : Promise.reject(new Error('Failed to load pipeline')))
      .then((data: unknown) => setPipelineJobIds(new Set(parsePipelineJobIdToEntryId(data).keys())))
      .catch(() => setPipelineError('Could not check your pipeline. Please try again.'));
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (roleCategories.length === 0) return null;

  const searchJobs = () => {
    const nextTitle = searchTitle.trim();
    if (!nextTitle) return;
    setPage(1);
    setExpandedJobId(null);
    setAlertState('idle');
    setActiveSearchTitle(nextTitle);
  };

  const saveAlert = async () => {
    setAlertState('saving');
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/wanted-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          jobTitle: activeSearchTitle,
          keywords: [activeSearchTitle],
          ...(seniority.trim() ? { seniority: seniority.trim() } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
          rawText: `Roadmap alert for ${activeSearchTitle}`,
        }),
      });
      setAlertState(res.ok ? 'saved' : 'error');
    } catch {
      setAlertState('error');
    }
  };

  const addToPipeline = async (job: StageOpportunity) => {
    const numericJobId = hashStringToNumber(job.jobId);
    setAddingJobId(job.jobId);
    setPipelineError('');
    try {
      const response = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          jobId: numericJobId,
          jobStage: 'wishlist',
          description: `${job.title} at ${job.company}`,
          source: 'career-roadmap',
        }),
      });
      if (!response.ok && response.status !== 409) throw new Error('Failed to add job to pipeline');
      setPipelineJobIds((current) => new Set(current).add(numericJobId));
    } catch {
      setPipelineError('Could not add this job to your pipeline. Please try again.');
    } finally {
      setAddingJobId(null);
    }
  };

  const applyNow = result.opportunities.filter((item) => item.fit === 'apply-now');
  const targetJobs = result.opportunities.filter((item) => item.fit === 'target');

  return (
    <div className="journey-opportunities">
      <button type="button" className="journey-opportunities-toggle" onClick={() => { setPage(1); setOpen(true); }}>
        View jobs connected to this stage
      </button>
      {open && (
        <div className="roadmap-jobs-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="roadmap-jobs-dialog" role="dialog" aria-modal="true" aria-labelledby="roadmap-jobs-title">
            <header className="roadmap-jobs-dialog-head">
              <div>
                <span>Roadmap opportunities</span>
                <h3 id="roadmap-jobs-title">Jobs connected to {activeSearchTitle}</h3>
              </div>
              <button type="button" className="roadmap-jobs-close" onClick={() => setOpen(false)} aria-label="Close jobs dialog">×</button>
            </header>
            <div className="roadmap-jobs-scroll">
              <form className="roadmap-job-title-search" onSubmit={(event) => { event.preventDefault(); searchJobs(); }}>
                <label htmlFor={searchTitleInputId}>Search job title</label>
                <div>
                  <input
                    id={searchTitleInputId}
                    type="search"
                    value={searchTitle}
                    onChange={(event) => setSearchTitle(event.target.value)}
                    placeholder="For example: CEO of Payoneer Fintech"
                  />
                  <button type="submit" disabled={!searchTitle.trim() || loading}>Search jobs</button>
                </div>
              </form>
              {loading && <p className="journey-opportunities-loading">Loading jobs…</p>}
              {error && <p className="journey-opportunities-error">{error}</p>}
              {pipelineError && <p className="journey-opportunities-error">{pipelineError}</p>}
              {!loading && !error && result.opportunities.length === 0 && (
                <div className="roadmap-jobs-empty">
                  <h4>No matching jobs are available right now</h4>
                  <p>Save this role and CareerCoach will alert you in the app when a matching job is added.</p>
                  {editingAlert && (
                    <div className="roadmap-alert-options">
                      <label>Seniority (optional)<input value={seniority} onChange={(event) => setSeniority(event.target.value)} /></label>
                      <label>Location or remote (optional)<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
                    </div>
                  )}
                  <div className="roadmap-alert-actions">
                    <button type="button" onClick={() => void saveAlert()} disabled={alertState === 'saving' || alertState === 'saved'}>
                      {alertState === 'saving' ? 'Saving…' : alertState === 'saved' ? 'Alert saved' : 'Add job alert'}
                    </button>
                    {alertState !== 'saved' && <button type="button" className="secondary" onClick={() => setEditingAlert((value) => !value)}>Edit alert</button>}
                  </div>
                  {alertState === 'error' && <p className="journey-opportunities-error">Could not save the alert. Please try again.</p>}
                </div>
              )}
              {!loading && !error && (
                <>
                  <OpportunityList title="Apply now" items={applyNow} expandedJobId={expandedJobId} addingJobId={addingJobId} pipelineJobIds={pipelineJobIds} onToggleDetails={(id) => setExpandedJobId((value) => value === id ? null : id)} onAddToPipeline={(job) => void addToPipeline(job)} />
                  <OpportunityList title="Target jobs" items={targetJobs} expandedJobId={expandedJobId} addingJobId={addingJobId} pipelineJobIds={pipelineJobIds} onToggleDetails={(id) => setExpandedJobId((value) => value === id ? null : id)} onAddToPipeline={(job) => void addToPipeline(job)} />
                </>
              )}
            </div>
            {result.pagination.totalPages > 1 && (
              <footer className="roadmap-jobs-pagination">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {page} of {result.pagination.totalPages}</span>
                <button type="button" disabled={page >= result.pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
              </footer>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
