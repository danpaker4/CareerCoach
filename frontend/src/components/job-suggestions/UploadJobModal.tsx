import { useState } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconX from '../../assets/icon-x.svg';
import iconPlus from '../../assets/icon-plus.svg';
import './UploadJobModal.css';

interface UploadJobModalProps {
  onClose: () => void;
  onCreated: () => void;
}

interface FormState {
  jobTitle: string;
  company: string;
  url: string;
  seniority: string;
  salary: string;
  description: string;
}

const INITIAL_FORM: FormState = {
  jobTitle: '',
  company: '',
  url: '',
  seniority: 'mid',
  salary: '',
  description: '',
};

const SENIORITY_OPTIONS = ['intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'manager'];

export const UploadJobModal = ({ onClose, onCreated }: UploadJobModalProps) => {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError('');
  };

  const validate = (): string | null => {
    if (!form.jobTitle.trim()) return 'Job title is required.';
    if (!form.company.trim()) return 'Company is required.';
    const trimmedUrl = form.url.trim();
    if (trimmedUrl) {
      try {
        const parsed = new URL(trimmedUrl);
        if (!/^https?:$/.test(parsed.protocol)) return 'URL must start with http:// or https://';
      } catch {
        return 'Please enter a valid URL or leave it blank.';
      }
    }
    if (!form.description.trim()) return 'Description is required so we can extract skills.';
    if (form.description.trim().length < 40) return 'Description is too short — paste more of the job posting so skills can be extracted.';
    if (form.salary.trim()) {
      const n = Number(form.salary.trim());
      if (!Number.isFinite(n) || n < 0) return 'Salary must be a positive number.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSubmitting(true);
    setError('');

    const salaryNumber = form.salary.trim() ? Number(form.salary.trim()) : undefined;
    const trimmedUrl = form.url.trim();
    const payload = {
      jobTitle: form.jobTitle.trim(),
      company: form.company.trim(),
      seniority: form.seniority.trim(),
      description: form.description.trim(),
      ...(trimmedUrl ? { url: trimmedUrl } : {}),
      ...(salaryNumber !== undefined ? { salary: Math.round(salaryNumber) } : {}),
    };

    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/jobs`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status !== 201) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Server returned ${res.status}`);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload job.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card upload-job-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Upload a job</h2>
            <p className="upload-job-subtitle">Paste the description and we'll extract the skills.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <img src={iconX} alt="" aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body upload-job-body">
          <div className="upload-job-row">
            <div className="modal-field">
              <label className="modal-label" htmlFor="upload-job-title">Job title *</label>
              <input
                id="upload-job-title"
                type="text"
                className="modal-input"
                placeholder="e.g. Senior Backend Engineer"
                value={form.jobTitle}
                onChange={updateField('jobTitle')}
                maxLength={200}
                autoFocus
              />
            </div>
            <div className="modal-field">
              <label className="modal-label" htmlFor="upload-job-company">Company *</label>
              <input
                id="upload-job-company"
                type="text"
                className="modal-input"
                placeholder="e.g. Acme Corp"
                value={form.company}
                onChange={updateField('company')}
                maxLength={200}
              />
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="upload-job-url">Job URL <span className="upload-job-optional">(optional)</span></label>
            <input
              id="upload-job-url"
              type="url"
              className="modal-input"
              placeholder="https://www.linkedin.com/jobs/view/…"
              value={form.url}
              onChange={updateField('url')}
              maxLength={2048}
            />
          </div>

          <div className="upload-job-row">
            <div className="modal-field">
              <label className="modal-label" htmlFor="upload-job-seniority">Seniority *</label>
              <select
                id="upload-job-seniority"
                className="modal-input"
                value={form.seniority}
                onChange={updateField('seniority')}
              >
                {SENIORITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label" htmlFor="upload-job-salary">Salary (yearly, optional)</label>
              <input
                id="upload-job-salary"
                type="number"
                className="modal-input"
                placeholder="120000"
                value={form.salary}
                onChange={updateField('salary')}
                min={0}
              />
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="upload-job-description">Description *</label>
            <textarea
              id="upload-job-description"
              className="modal-input upload-job-textarea"
              placeholder="Paste the full job description here. We use this to extract required skills, technologies, and benefits."
              value={form.description}
              onChange={updateField('description')}
              rows={8}
              maxLength={20000}
            />
            <p className="upload-job-hint">
              Tip: open the LinkedIn / company job page, copy the description, and paste it here. Skills are extracted automatically — this may take a few seconds.
            </p>
          </div>

          {error && <p className="form-error upload-job-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              'Uploading…'
            ) : (
              <>
                <img src={iconPlus} alt="" aria-hidden="true" className="btn-icon btn-icon--white" />
                <span>Upload job</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
