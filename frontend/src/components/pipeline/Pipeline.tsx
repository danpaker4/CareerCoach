import { useState, useEffect, useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconKanban from '../../assets/icon-kanban.svg';
import iconBriefcase from '../../assets/icon-briefcase.svg';
import iconPlus from '../../assets/icon-plus.svg';
import iconX from '../../assets/icon-x.svg';
import './Pipeline.css';
import type {
  PipelineJob,
  PipelineColumn,
  PipelineProps,
  PipelineStage,
  NewJobForm,
  FetchState,
  PipelineDragState,
  PipelineDragPosition,
} from './pipeline.types';

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

const isPipelineStage = (value: unknown): value is PipelineStage =>
  typeof value === 'string' && STAGE_ORDER.some((stage) => stage === value);

const getStageFromElement = (element: Element | null): PipelineStage | null => {
  const stage = element?.closest<HTMLElement>('[data-pipeline-stage]')?.dataset.pipelineStage;
  return isPipelineStage(stage) ? stage : null;
};

const parseJobs = (data: unknown): PipelineJob[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is PipelineJob => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.userId === 'string' &&
      typeof obj.jobId === 'number' &&
      isPipelineStage(obj.jobStage) &&
      typeof obj.description === 'string'
    );
  });
};

const DEFAULT_FORM: NewJobForm = { description: '', jobStage: 'wishlist', jobId: 0 };

interface JobCardProps {
  job: PipelineJob;
  onMove: (id: string, stage: PipelineStage) => void;
  onDelete: (id: string) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, job: PipelineJob) => void;
  moving: boolean;
  deleting: boolean;
  isDragging: boolean;
}

const JobCard = ({ job, onMove, onDelete, onPointerDown, moving, deleting, isDragging }: JobCardProps) => {
  const [showStageMenu, setShowStageMenu] = useState(false);

  return (
    <div
      className={`job-card${deleting ? ' job-card--deleting' : ''}${isDragging ? ' job-card--dragging' : ''}`}
      onPointerDown={(event) => onPointerDown(event, job)}
      aria-grabbed={isDragging}
    >
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

interface DragPreviewCardProps {
  job: PipelineJob;
  previewRef: (element: HTMLDivElement | null) => void;
}

const DragPreviewCard = ({ job, previewRef }: DragPreviewCardProps) => (
  <div
    className="job-card-overlay-preview"
    ref={previewRef}
    aria-hidden="true"
  >
    <div className="job-card-overlay-preview-top">
      <img src={iconBriefcase} alt="" aria-hidden="true" className="job-card-overlay-preview-icon" />
      <p className="job-card-overlay-preview-description">{job.description || `Job #${job.jobId}`}</p>
    </div>
    <div className="job-card-overlay-preview-footer">
      <span className="job-card-overlay-preview-ref">Job #{job.jobId}</span>
    </div>
  </div>
);

const DEFAULT_DRAG_POSITION: PipelineDragPosition = { x: 0, y: 0 };
const DRAG_PREVIEW_TRANSFORM_SUFFIX = 'translate(0, -54px) scale(1.03)';

export const Pipeline = ({ user }: PipelineProps) => {
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<NewJobForm>(DEFAULT_FORM);
  const [adding, setAdding] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<PipelineDragState | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const dragPositionRef = useRef<PipelineDragPosition>(DEFAULT_DRAG_POSITION);
  const dragPreviewElementRef = useRef<HTMLDivElement | null>(null);
  const dragSourceElementRef = useRef<HTMLDivElement | null>(null);
  const dragOverStageRef = useRef<PipelineStage | null>(null);
  const pendingPointerPositionRef = useRef<PipelineDragPosition | null>(null);
  const dragAnimationFrameRef = useRef<number | null>(null);

  const loadData = useCallback(() => {
    if (!user?.id) return;
    setFetchState('loading');
    apiFetch(JOBS_URL(user.id), { credentials: 'include' })
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

  const applyDragPreviewPosition = useCallback((position: PipelineDragPosition) => {
    dragPositionRef.current = position;

    if (!dragPreviewElementRef.current) {
      return;
    }

    dragPreviewElementRef.current.style.transform =
      `translate3d(${position.x}px, ${position.y}px, 0) ${DRAG_PREVIEW_TRANSFORM_SUFFIX}`;
  }, []);

  const bindDragPreviewRef = useCallback((element: HTMLDivElement | null) => {
    dragPreviewElementRef.current = element;

    if (!element) {
      return;
    }

    applyDragPreviewPosition(dragPositionRef.current);
  }, [applyDragPreviewPosition]);

  const applyQueuedDragPosition = useCallback(() => {
    dragAnimationFrameRef.current = null;

    const nextPosition = pendingPointerPositionRef.current;

    if (!nextPosition) {
      return;
    }

    const nextStage = getStageFromElement(document.elementFromPoint(nextPosition.x, nextPosition.y));

    if (dragOverStageRef.current === nextStage) {
      return;
    }

    dragOverStageRef.current = nextStage;
    setDragOverStage(nextStage);
  }, [applyDragPreviewPosition]);

  const queueDragPositionUpdate = useCallback((position: PipelineDragPosition) => {
    pendingPointerPositionRef.current = position;

    if (dragAnimationFrameRef.current !== null) {
      return;
    }

    dragAnimationFrameRef.current = window.requestAnimationFrame(applyQueuedDragPosition);
  }, [applyQueuedDragPosition]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    document.body.style.userSelect = 'none';

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      const nextPosition: PipelineDragPosition = {
        x: event.clientX,
        y: event.clientY,
      };

      applyDragPreviewPosition(nextPosition);
      queueDragPositionUpdate(nextPosition);
    };

    const finishWindowPointerDrag = (event: PointerEvent) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      const sourceElement = dragSourceElementRef.current;

      if (sourceElement?.hasPointerCapture(event.pointerId)) {
        sourceElement.releasePointerCapture(event.pointerId);
      }

      const targetStage = getStageFromElement(document.elementFromPoint(event.clientX, event.clientY));
      const activeDragState = dragState;

      setDragState(null);
      setDragOverStage(null);
      dragOverStageRef.current = null;
      pendingPointerPositionRef.current = null;
      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
      dragPositionRef.current = DEFAULT_DRAG_POSITION;

      if (!targetStage || targetStage === activeDragState.sourceStage) {
        return;
      }

      void handleMoveJob(activeDragState.jobId, targetStage);
    };

    const cancelWindowPointerDrag = (event: PointerEvent) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      const sourceElement = dragSourceElementRef.current;

      if (sourceElement?.hasPointerCapture(event.pointerId)) {
        sourceElement.releasePointerCapture(event.pointerId);
      }

      setDragState(null);
      setDragOverStage(null);
      dragOverStageRef.current = null;
      pendingPointerPositionRef.current = null;
      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
      dragPositionRef.current = DEFAULT_DRAG_POSITION;
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', finishWindowPointerDrag);
    window.addEventListener('pointercancel', cancelWindowPointerDrag);

    return () => {
      document.body.style.userSelect = '';
      dragOverStageRef.current = null;
      pendingPointerPositionRef.current = null;
      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', finishWindowPointerDrag);
      window.removeEventListener('pointercancel', cancelWindowPointerDrag);
    };
  }, [applyDragPreviewPosition, dragState, queueDragPositionUpdate]);

  const handleAddJob = async () => {
    if (!user?.id || !form.description.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline`, {
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
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${id}/stage`, {
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
      await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${id}`, {
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

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>, job: PipelineJob) => {
    if (event.button !== 0) {
      return;
    }

    if (event.target instanceof HTMLElement && event.target.closest('button')) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSourceElementRef.current = event.currentTarget;
    applyDragPreviewPosition({
      x: event.clientX,
      y: event.clientY,
    });
    flushSync(() => {
      dragOverStageRef.current = job.jobStage;
      setDragOverStage(job.jobStage);
      setDragState({
        jobId: job.id,
        pointerId: event.pointerId,
        sourceStage: job.jobStage,
      });
    });
  }, [applyDragPreviewPosition]);

  const jobsByStage = (stage: PipelineStage) =>
    jobs.filter((j) => j.jobStage === stage);
  const draggedJob = dragState ? jobs.find((job) => job.id === dragState.jobId) ?? null : null;

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
      {draggedJob && <DragPreviewCard job={draggedJob} previewRef={bindDragPreviewRef} />}
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
              const isDragTarget = dragOverStage === col.id && dragState?.sourceStage !== col.id;
              return (
                <div
                  key={col.id}
                  data-pipeline-stage={col.id}
                  className={`kanban-column${isDragTarget ? ' kanban-column--drag-over' : ''}`}
                >
                  <div className="kanban-column-header">
                    <span className="kanban-column-label">{col.label}</span>
                    <span className={`badge ${col.badgeClass}`}>{colJobs.length}</span>
                  </div>
                  <div className={`kanban-cards${isDragTarget ? ' kanban-cards--drag-over' : ''}`}>
                    {colJobs.length > 0
                      ? colJobs.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            onMove={handleMoveJob}
                            onDelete={handleDeleteJob}
                            onPointerDown={handlePointerDown}
                            moving={movingId === job.id}
                            deleting={deletingId === job.id}
                            isDragging={dragState?.jobId === job.id}
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
