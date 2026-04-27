import { useState } from 'react';
import { ENV } from '../../config';
import iconX from '../../assets/icon-x.svg';
import iconCheck from '../../assets/icon-check.svg';
import iconPlus from '../../assets/icon-plus.svg';
import './CreateRoadmapModal.css';

interface CreateRoadmapModalProps {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<number, string> = {
  1: 'Foundation & Fundamentals',
  2: 'Intermediate Growth',
  3: 'Advanced Proficiency',
  4: 'Leadership & Expertise',
  5: 'Target Role Achievement',
};

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

export const CreateRoadmapModal = ({ userId, onClose, onCreated }: CreateRoadmapModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [dreamJob, setDreamJob] = useState('');
  const [stageCount, setStageCount] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!dreamJob.trim()) { setError('Please enter your dream job title.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const stages = Array.from({ length: stageCount }, (_, i) => ({ jobId: i + 1, isDone: false }));
      const res = await fetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, dreamJob: dreamJob.trim(), stagesToDreamJob: stages }),
      });
      if (!res.ok) throw new Error('Failed to create roadmap');
      onCreated();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
                  <span>{STEP_LABELS[i + 1]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <div className="modal-body step-body">
            <h3 className="step-question">Ready to create your roadmap?</h3>
            <p className="step-hint">Here's a summary of what will be created.</p>

            <div className="confirm-summary">
              <div className="confirm-row">
                <span className="confirm-label">Dream Job</span>
                <span className="confirm-value">{dreamJob}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">Milestones</span>
                <span className="confirm-value">{stageCount} steps</span>
              </div>
              <div className="confirm-stages">
                {Array.from({ length: stageCount }, (_, i) => (
                  <div key={i} className="confirm-stage-item">
                    <div className="confirm-stage-dot" />
                    <span>Step {i + 1}: {STEP_LABELS[i + 1]}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          {step > 1 && (
            <button type="button" className="btn-outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={step < 3 ? () => { if (step === 1 && !dreamJob.trim()) { setError('Please enter your dream job title.'); return; } setStep((s) => (s + 1) as Step); } : handleSubmit}
            disabled={submitting}
          >
            {step < 3
              ? <><span>Next</span><img src={iconPlus} alt="" aria-hidden="true" className="btn-icon btn-icon--white" /></>
              : submitting ? 'Creating…' : 'Create Roadmap'}
          </button>
        </div>

      </div>
    </div>
  );
};
