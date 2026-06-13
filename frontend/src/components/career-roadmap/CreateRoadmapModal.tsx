import { useState, useEffect, useRef } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconX from '../../assets/icon-x.svg';
import iconCheck from '../../assets/icon-check.svg';
import iconPlus from '../../assets/icon-plus.svg';
import { getPlatformStyle } from './platform-config';
import './CreateRoadmapModal.css';
import type { StageContent, RoadmapGenerationResponse } from './career-roadmap.types';

interface CreateRoadmapModalProps {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

type Step = 1 | 2 | 3;
type GenerationState = 'idle' | 'generating' | 'success' | 'error';

const PRESET_ROLES = [
  'Senior Frontend Engineer',
  'Senior Full Stack Engineer',
  'Backend Engineer',
  'DevOps / Platform Engineer',
  'Engineering Manager',
  'Product Manager',
  'Data Engineer',
  'Mobile Developer',
];

const isValidGenerationResponse = (data: unknown): data is RoadmapGenerationResponse => {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.stages)) return false;
  return obj.stages.length > 0 && obj.stages.every((s: unknown) => {
    if (typeof s !== 'object' || s === null) return false;
    const stage = s as Record<string, unknown>;
    return typeof stage.label === 'string' && typeof stage.description === 'string' && Array.isArray(stage.actions);
  });
};

export const CreateRoadmapModal = ({ userId, onClose, onCreated }: CreateRoadmapModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [dreamJob, setDreamJob] = useState('');
  const [stageCount, setStageCount] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [generatedStages, setGeneratedStages] = useState<StageContent[]>([]);
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [generationError, setGenerationError] = useState('');
  const [generationKey, setGenerationKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Trigger AI generation when entering step 3 or when generationKey bumps
  useEffect(() => {
    if (step !== 3 || generationState === 'success') return;

    // Abort any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerationState('generating');
    setGenerationError('');

    apiFetch(`${ENV.ROADMAP_SERVICE_BASE_URL}/roadmap/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, dreamJob: dreamJob.trim(), stageCount }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error(`Generation failed (${res.status})`);
        const data: unknown = await res.json();
        if (!isValidGenerationResponse(data)) {
          throw new Error('Invalid generation response');
        }
        setGeneratedStages(data.stages);
        setGenerationState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (controller.signal.aborted) return;
        setGenerationError(err instanceof Error ? err.message : 'Generation failed');
        setGenerationState('error');
      });

    return () => { controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, generationKey]);

  const retryGeneration = () => {
    abortRef.current?.abort();
    setGenerationState('idle');
    setGeneratedStages([]);
    setGenerationError('');
    setGenerationKey((k) => k + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const stages = generatedStages.length > 0
        ? generatedStages.map((content, i) => ({ jobId: i + 1, isDone: false, content }))
        : Array.from({ length: stageCount }, (_, i) => ({ jobId: i + 1, isDone: false }));

      const body: Record<string, unknown> = {
        userId,
        dreamJob: dreamJob.trim(),
        stagesToDreamJob: stages,
      };
      if (generatedStages.length > 0) {
        body.generatedAt = new Date().toISOString();
      }

      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create roadmap');
      onCreated();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFallbackCreate = () => {
    setGeneratedStages([]);
    setGenerationState('success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card create-roadmap-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create Career Roadmap</h2>
            <p className="modal-step-indicator">Step {step} of 3</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <img src={iconX} alt="" aria-hidden="true" />
          </button>
        </div>

        {/* Step progress bar */}
        <div className="create-roadmap-progress">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={`progress-pip ${step >= s ? 'progress-pip--active' : ''} ${step > s ? 'progress-pip--done' : ''}`}>
              {step > s
                ? <img src={iconCheck} alt="" aria-hidden="true" className="pip-check" />
                : s}
            </div>
          ))}
          <div className="progress-line">
            <div className="progress-line-fill" style={{ width: `${((step - 1) / 2) * 100}%` }} />
          </div>
        </div>

        {/* Step 1 — Dream Job */}
        {step === 1 && (
          <div className="modal-body step-body">
            <h3 className="step-question">What's your dream job title?</h3>
            <p className="step-hint">This is the role you're working towards.</p>

            <input
              type="text"
              className="modal-input"
              placeholder="e.g. Senior Full Stack Engineer"
              value={dreamJob}
              onChange={(e) => { setDreamJob(e.target.value); setError(''); }}
              autoFocus
            />

            <div className="preset-roles">
              {PRESET_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`preset-chip ${dreamJob === role ? 'preset-chip--active' : ''}`}
                  onClick={() => { setDreamJob(role); setError(''); }}
                >
                  {role}
                </button>
              ))}
            </div>

            {error && <p className="form-error">{error}</p>}
          </div>
        )}

        {/* Step 2 — Stage count */}
        {step === 2 && (
          <div className="modal-body step-body">
            <h3 className="step-question">How many milestones do you want?</h3>
            <p className="step-hint">Each milestone is a step on your journey to <strong>{dreamJob}</strong>.</p>

            <div className="stage-count-row">
              <button
                type="button"
                className="stage-count-btn"
                onClick={() => setStageCount((c) => Math.max(2, c - 1))}
                disabled={stageCount <= 2}
              >−</button>
              <span className="stage-count-num">{stageCount}</span>
              <button
                type="button"
                className="stage-count-btn"
                onClick={() => setStageCount((c) => Math.min(5, c + 1))}
                disabled={stageCount >= 5}
              >+</button>
            </div>

            <div className="stage-preview">
              {Array.from({ length: stageCount }, (_, i) => (
                <div key={i} className="stage-preview-item">
                  <div className="stage-preview-num">{i + 1}</div>
                  <span>Stage {i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — AI Generation + Preview */}
        {step === 3 && (
          <div className="modal-body step-body">
            {generationState === 'generating' && (
              <div className="generation-loading">
                <div className="spinner" />
                <h3 className="generation-loading-title">Generating your personalized roadmap</h3>
                <p className="generation-loading-hint">
                  Analyzing your skills, real job requirements, and career paths for <strong>{dreamJob}</strong>...
                </p>
              </div>
            )}

            {generationState === 'error' && (
              <div className="generation-error">
                <h3 className="step-question">Generation failed</h3>
                <p className="step-hint">{generationError || 'Could not generate your roadmap. Please try again.'}</p>
                <div className="generation-error-actions">
                  <button type="button" className="btn-primary" onClick={retryGeneration}>
                    Retry
                  </button>
                  <button type="button" className="generation-fallback-btn" onClick={handleFallbackCreate}>
                    Use generic stages instead
                  </button>
                </div>
              </div>
            )}

            {generationState === 'success' && generatedStages.length > 0 && (
              <div className="generation-preview">
                <h3 className="step-question">Your personalized roadmap</h3>
                <p className="step-hint">Review the AI-generated stages for <strong>{dreamJob}</strong>.</p>

                <div className="generation-stage-list">
                  {generatedStages.map((stage, i) => (
                    <div key={i} className="generation-stage-card">
                      <div className="generation-stage-header">
                        <div className="generation-stage-num">{i + 1}</div>
                        <div className="generation-stage-info">
                          <h4 className="generation-stage-label">{stage.label}</h4>
                          {stage.estimatedTimeframe && (
                            <span className="timeframe-badge">{stage.estimatedTimeframe}</span>
                          )}
                        </div>
                      </div>
                      <p className="generation-stage-desc">{stage.description}</p>
                      {stage.actions.length > 0 && (
                        <ul className="generation-stage-actions">
                          {stage.actions.slice(0, 3).map((action, j) => (
                            <li key={j}>{action}</li>
                          ))}
                          {stage.actions.length > 3 && (
                            <li className="generation-stage-more">+{stage.actions.length - 3} more</li>
                          )}
                        </ul>
                      )}
                      {stage.resources && stage.resources.length > 0 && (
                        <div className="generation-resource-row">
                          {stage.resources.slice(0, 3).map((r, j) => {
                            const ps = getPlatformStyle(r.platform);
                            return (
                              <a
                                key={j}
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="generation-resource-chip"
                                style={{ '--platform-accent': ps.accentColor } as React.CSSProperties}
                              >
                                <span className="generation-resource-platform">
                                  <span className="generation-resource-icon">{ps.icon}</span>
                                  {ps.label}
                                </span>
                                <span className="generation-resource-title">{r.title}</span>
                              </a>
                            );
                          })}
                          {stage.resources.length > 3 && (
                            <span className="generation-resource-more">+{stage.resources.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {generationState === 'success' && generatedStages.length === 0 && (
              <div className="generation-preview">
                <h3 className="step-question">Ready to create your roadmap?</h3>
                <p className="step-hint">Your roadmap for <strong>{dreamJob}</strong> will be created with {stageCount} generic stages.</p>
              </div>
            )}

            {error && <p className="form-error">{error}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          {step > 1 && step !== 3 && (
            <button type="button" className="btn-outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </button>
          )}
          {step === 3 && generationState !== 'generating' && (
            <button type="button" className="btn-outline" onClick={() => {
              setGenerationState('idle');
              setGeneratedStages([]);
              setStep(2);
            }}>
              Back
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          )}
          {step < 3 && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (step === 1 && !dreamJob.trim()) { setError('Please enter your dream job title.'); return; }
                setStep((s) => (s + 1) as Step);
              }}
            >
              <span>Next</span>
              <img src={iconPlus} alt="" aria-hidden="true" className="btn-icon btn-icon--white" />
            </button>
          )}
          {step === 3 && generationState === 'success' && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Roadmap'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
