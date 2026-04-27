import { useState, useEffect, useCallback } from 'react';
import { ENV } from '../../config';
import iconKanban from '../../assets/icon-kanban.svg';
import iconBriefcase from '../../assets/icon-briefcase.svg';
import iconPlus from '../../assets/icon-plus.svg';
import iconX from '../../assets/icon-x.svg';
import './Pipeline.css';
import type { PipelineJob, PipelineColumn, PipelineProps, PipelineStage, NewJobForm, FetchState } from './pipeline.types';

const JOBS_URL = (userId: string) =>
  `${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${userId}`;

const COLUMNS: PipelineColumn[] = [
  { id: 'wishlist',  label: 'Wishlist',  badgeClass: 'badge-blue' },
  { id: 'applied',   label: 'Applied',   badgeClass: 'badge-yellow' },
  { id: 'interview', label: 'Interview', badgeClass: 'badge-purple' },
  { id: 'offer',     label: 'Offer',     badgeClass: 'badge-green' },
  { id: 'rejected',  label: 'Rejected',  badgeClass: 'badge-red' },
];

const STAGE_ORDER: PipelineStage[] = ['wishlist', 'applied', 'interview', 'offer', 'rejected'];

const parseJobs = (data: unknown): PipelineJob[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is PipelineJob => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.userId === 'string' &&
      typeof obj.jobId === 'number' &&
      typeof obj.jobStage === 'string' &&
      typeof obj.description === 'string'
    );
  });
};

const DEFAULT_FORM: NewJobForm = { description: '', jobStage: 'wishlist', jobId: 0 };

interface JobCardProps {
  job: PipelineJob;
  onMove: (id: string, stage: PipelineStage) => void;
  onDelete: (id: string) => void;
  moving: boolean;
  deleting: boolean;
}

const JobCard = ({ job, onMove, onDelete, moving, deleting }: JobCardProps) => {
  const [showStageMenu, setShowStageMenu] = useState(false);

  return (
    <div className={`job-card${deleting ? ' job-card--deleting' : ''}`}>
      <div className="job-card-top">
        <img src={iconBriefcase} alt="" aria-hidden="true" className="job-card-icon" />
        <p className="job-description">{job.description || `Job #${job.jobId}`}</p>
        <button
          type="button"
          className="job-delete-btn"
          onClick={() => onDelete(job.id)}
          disabled={deleting}
          aria-label="Remove job"
        >
          <img src={iconX} alt="" aria-hidden="true" className="job-delete-icon" />
        </button>
      </div>

      <div className="job-card-footer">
        <span className="job-ref">Job #{job.jobId}</span>
        <div className="stage-move-wrap">
          <button
            type="button"
            className="btn-move-stage"
            onClick={() => setShowStageMenu(!showStageMenu)}
            disabled={moving}
          >
            {moving ? 'Moving…' : 'Move'}
          </button>
          {showStageMenu && (
            <div className="stage-menu">
              {STAGE_ORDER.filter((s) => s !== job.jobStage).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="stage-menu-item"
                  onClick={() => { onMove(job.id, s); setShowStageMenu(false); }}
                >
                  {COLUMNS.find((c) => c.id === s)?.label ?? s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Pipeline = ({ user }: PipelineProps) => {
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<NewJobForm>(DEFAULT_FORM);
  const [adding, setAdding] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!user?.id) return;
    setFetchState('loading');
    fetch(JOBS_URL(user.id), { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 404) { setJobs([]); setFetchState('success'); return; }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data: unknown = await res.json();
        setJobs(parseJobs(data));
        setFetchState('success');
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
        setFetchState('error');
      });
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddJob = async () => {
    if (!user?.id || !form.description.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          jobId: form.jobId || Math.floor(Math.random() * 9000) + 1000,
          jobStage: form.jobStage,
          description: form.description.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to add job');
      const newJob: unknown = await res.json();
      if (typeof newJob === 'object' && newJob !== null) {
        setJobs((prev) => [...prev, newJob as PipelineJob]);
      }
      setForm(DEFAULT_FORM);
      setShowAddModal(false);
    } catch {
      // silently fail - user can retry
    } finally {
      setAdding(false);
    }
  };

  const handleMoveJob = async (id: string, stage: PipelineStage) => {
    setMovingId(id);
    try {
      const res = await fetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobStage: stage }),
      });
      if (!res.ok) throw new Error('Failed to move job');
      setJobs((prev) => prev.map((j) => j.id === id ? { ...j, jobStage: stage } : j));
    } catch {
      // silently fail
    } finally {
      setMovingId(null);
    }
  };

  const handleDeleteJob = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const jobsByStage = (stage: PipelineStage) =>
    jobs.filter((j) => j.jobStage === stage);

  if (!user) {
    return (
      <div className="pipeline-page">
        <div className="page-empty">
          <img src={iconKanban} alt="" className="empty-icon-lg" aria-hidden="true" />
          <p>Please log in to view your job pipeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pipeline-page">
      <div className="pipeline-header-bar">
        <div className="pipeline-header-inner">
          <div>
            <h1 className="pipeline-title">My Pipeline</h1>
            <p className="pipeline-subtitle">Track every application from wishlist to offer</p>
          </div>
          <div className="pipeline-header-actions">
            {fetchState === 'success' && (
              <span className="pipeline-total">{jobs.length} job{jobs.length !== 1 ? 's' : ''} tracked</span>
            )}
            <button type="button" className="btn-primary" onClick={() => setShowAddModal(true)}>
              <img src={iconPlus} alt="" aria-hidden="true" className="btn-icon btn-icon--white" />
              Add Job
            </button>
          </div>
        </div>
      </div>

      {fetchState === 'loading' && (
        <div className="page-loading"><div className="spinner" /><p>Loading your pipeline...</p></div>
      )}

      {fetchState === 'error' && (
        <div className="page-error">
          <p>Could not load pipeline: {errorMessage}</p>
          <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={loadData}>Try Again</button>
        </div>
      )}

      {(fetchState === 'success' || fetchState === 'idle') && (
        <div className="kanban-scroll-area">
          <div className="kanban-board">
            {COLUMNS.map((col) => {
              const colJobs = jobsByStage(col.id);
              return (
                <div key={col.id} className="kanban-column">
                  <div className="kanban-column-header">
                    <span className="kanban-column-label">{col.label}</span>
                    <span className={`badge ${col.badgeClass}`}>{colJobs.length}</span>
                  </div>
                  <div className="kanban-cards">
                    {colJobs.length > 0
                      ? colJobs.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            onMove={handleMoveJob}
                            onDelete={handleDeleteJob}
                            moving={movingId === job.id}
                            deleting={deletingId === job.id}
                          />
                        ))
                      : (
                        <div className="kanban-empty">
                          <img src={iconBriefcase} alt="" aria-hidden="true" className="kanban-empty-icon" />
                          <p>No jobs here</p>
                        </div>
                      )}
                    {col.id === 'wishlist' && colJobs.length === 0 && fetchState === 'success' && (
                      <button type="button" className="kanban-add-btn" onClick={() => setShowAddModal(true)}>
                        <img src={iconPlus} alt="" aria-hidden="true" className="kanban-add-icon" />
                        Add your first job
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Job to Pipeline</h2>
              <button type="button" className="modal-close" onClick={() => setShowAddModal(false)} aria-label="Close">
                <img src={iconX} alt="" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-field">
                <label htmlFor="job-description" className="modal-label">Job Description / Title</label>
                <input
                  id="job-description"
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Senior Frontend Developer at Acme Corp"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="modal-field">
                <label htmlFor="job-stage" className="modal-label">Pipeline Stage</label>
                <select
                  id="job-stage"
                  className="modal-input"
                  value={form.jobStage}
                  onChange={(e) => setForm((f) => ({ ...f, jobStage: e.target.value as PipelineStage }))}
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>{col.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddJob}
                disabled={adding || !form.description.trim()}
              >
                {adding ? 'Adding…' : 'Add Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
