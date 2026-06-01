import { useState, useEffect, useCallback, useRef } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { connectGithubAccount } from '../../lib/githubAuth';
import iconUser from '../../assets/icon-user.svg';
import iconBriefcase from '../../assets/icon-briefcase.svg';
import iconCheck from '../../assets/icon-check.svg';
import iconZap from '../../assets/icon-zap.svg';
import githubIcon from '../../assets/github-icon.svg';
import type { User } from '../../types/user';
import './Profile.css';

interface ProfileProps {
  user: User;
  onUserUpdated: (updated: User) => void;
  onLogout: () => void;
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  email: string;
  currentJob: string;
  linkedInUrl: string;
  githubUrl: string;
}

const USERS_URL = (userId: string) => `${ENV.USERS_SERVICE_BASE_URL}/users/${userId}`;
const USERS_CV_URL = (userId: string) => `${ENV.USERS_SERVICE_BASE_URL}/users/${userId}/cv`;

const getInitials = (firstName: string, lastName: string): string =>
  (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();

const getGithubUsername = (githubUrl: string | undefined): string | null => {
  if (!githubUrl) {
    return null;
  }

  try {
    const parsed = new URL(githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`);
    return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
};

export const Profile = ({ user, onUserUpdated, onLogout }: ProfileProps) => {
  const [form, setForm] = useState<ProfileForm>({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    currentJob: user.currentJob ?? '',
    linkedInUrl: user.linkedInUrl ?? '',
    githubUrl: user.githubUrl ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvExtracting, setCvExtracting] = useState(false);
  const [cvSuccess, setCvSuccess] = useState(false);
  const [cvError, setCvError] = useState('');
  const [cvSkillCount, setCvSkillCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(() => {
    apiFetch(USERS_URL(user.id), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as User;
        setForm({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          currentJob: data.currentJob ?? '',
          linkedInUrl: data.linkedInUrl ?? '',
          githubUrl: data.githubUrl ?? '',
        });
      })
      .catch(() => undefined);
  }, [user.id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleChange = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveSuccess(false);
    setError('');
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('First name, last name, and email are required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const body: Record<string, string> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
      };

      if (form.currentJob.trim()) body.currentJob = form.currentJob.trim();
      if (form.linkedInUrl.trim()) body.linkedInUrl = form.linkedInUrl.trim();
      if (form.githubUrl.trim()) body.githubUrl = form.githubUrl.trim();

      const res = await apiFetch(USERS_URL(user.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error('Failed to save changes');
      }

      onUserUpdated({ ...user, ...body });
      setSaveSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCvExtract = async () => {
    if (!cvFile) return;

    setCvExtracting(true);
    setCvError('');
    setCvSuccess(false);

    try {
      const formData = new FormData();
      formData.append('cv', cvFile);
      if (form.currentJob.trim()) formData.append('currentJob', form.currentJob.trim());
      if (form.linkedInUrl.trim()) formData.append('linkedInUrl', form.linkedInUrl.trim());
      if (form.githubUrl.trim()) formData.append('githubUrl', form.githubUrl.trim());

      const res = await apiFetch(USERS_CV_URL(user.id), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Failed to process CV');
      }

      const updatedUser = await res.json() as User;

      onUserUpdated(updatedUser);
      setCvSkillCount(updatedUser.achievements?.length ?? 0);
      setCvSuccess(true);
      setCvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      setCvError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setCvExtracting(false);
    }
  };

  const initials = getInitials(form.firstName || user.firstName, form.lastName || user.lastName);
  const displayName = `${form.firstName || user.firstName} ${form.lastName || user.lastName}`.trim();
  const githubUrlTrimmed = (form.githubUrl || user.githubUrl || '').trim();
  const isGithubConnected = githubUrlTrimmed.length > 0;
  const githubUsername = getGithubUsername(githubUrlTrimmed || undefined);
  const currentExtractedSkillCount = user.achievements?.length ?? 0;

  return (
    <div className="profile-page">
      <main className="profile-container">
        <div className="profile-header">
          <div>
            <h1 className="profile-title">My Profile</h1>
            <p className="profile-subtitle">Manage your personal information</p>
          </div>
          <button type="button" className="profile-logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>

        <div className="profile-layout">
          <aside className="profile-sidebar">
            <div className="avatar-card surface-card">
              <div className="profile-avatar-lg">{initials}</div>
              <h2 className="avatar-name">{displayName}</h2>
              {form.currentJob && (
                <div className="avatar-job">
                  <img src={iconBriefcase} alt="" aria-hidden="true" className="avatar-job-icon" />
                  <span>{form.currentJob}</span>
                </div>
              )}
              <div className="avatar-meta">
                <span className="avatar-email">{form.email}</span>
              </div>
              {(form.linkedInUrl || form.githubUrl) && (
                <div className="avatar-links">
                  {form.linkedInUrl && (
                    <a
                      href={form.linkedInUrl.startsWith('http') ? form.linkedInUrl : `https://${form.linkedInUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="avatar-link avatar-link--linkedin"
                    >
                      LinkedIn
                    </a>
                  )}
                  {form.githubUrl && (
                    <a
                      href={form.githubUrl.startsWith('http') ? form.githubUrl : `https://${form.githubUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="avatar-link avatar-link--github"
                    >
                      GitHub
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="cv-card profile-import-card surface-card">
              <div className="profile-import-card-header">
                <h3 className="profile-import-card-title">Skill imports</h3>
                <p className="profile-import-card-subtitle">Refresh your profile skills from CV and GitHub.</p>
              </div>

              <div className="profile-import-source">
                <div className="profile-source-header">
                  <span className="profile-source-icon-shell profile-source-icon-shell--cv">
                    <img src={iconZap} alt="" aria-hidden="true" className="profile-source-icon" />
                  </span>
                  <div className="profile-source-heading">
                    <h4 className="cv-card-title">Skills from CV</h4>
                    <p className="profile-source-kicker">Upload a new CV to refresh CV skills</p>
                  </div>
                </div>

                {currentExtractedSkillCount > 0 && (
                  <p className="cv-card-current">
                    <img src={iconCheck} alt="" aria-hidden="true" />
                    {currentExtractedSkillCount} skills currently extracted
                  </p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="cv-file-input"
                  id="cv-upload"
                  onChange={(e) => {
                    setCvFile(e.target.files?.[0] ?? null);
                    setCvSuccess(false);
                    setCvError('');
                  }}
                />
                <div className="profile-import-actions">
                  <label htmlFor="cv-upload" className="cv-file-label">
                    <span className="cv-file-label-kind">PDF</span>
                    <span className="cv-file-label-text">{cvFile ? cvFile.name : 'Choose'}</span>
                  </label>

                  <button
                    type="button"
                    className="btn-primary cv-extract-btn"
                    onClick={handleCvExtract}
                    disabled={!cvFile || cvExtracting}
                >
                  {cvExtracting ? 'Extracting...' : 'Extract'}
                </button>
              </div>

                {cvError && <p className="cv-error">{cvError}</p>}
                {cvSuccess && (
                  <p className="cv-success">
                    <img src={iconCheck} alt="" aria-hidden="true" />
                    Latest CV processed. {cvSkillCount} skills extracted.
                  </p>
                )}
              </div>

              <div className="profile-import-divider" />

              <div className="profile-import-source">
                <div className="profile-source-header">
                  <span className="profile-source-icon-shell profile-source-icon-shell--github">
                    <img src={githubIcon} alt="" aria-hidden="true" className="profile-source-icon profile-github-card-icon" />
                  </span>
                  <div className="profile-source-heading">
                    <h4 className="cv-card-title">Skills from GitHub</h4>
                    <p className="profile-source-kicker">Repository scan</p>
                  </div>
                </div>
                {isGithubConnected ? (
                  <>
                    <p className="cv-card-current">
                      <img src={iconCheck} alt="" aria-hidden="true" />
                      {githubUsername ? `Connected as @${githubUsername}` : 'GitHub profile connected'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="profile-import-actions">
                      <p className="profile-github-pending">
                        <span aria-hidden="true" className="profile-github-pending-dot" />
                        Disconnected
                      </p>
                      <button
                        type="button"
                        className="btn-primary cv-extract-btn"
                        onClick={() => connectGithubAccount('profile')}
                      disabled={!ENV.GITHUB_CLIENT_ID}
                    >
                      Connect
                    </button>
                    </div>
                    {!ENV.GITHUB_CLIENT_ID && (
                      <p className="cv-error">GitHub OAuth is not configured. Set `VITE_CLIENT_ID` in `frontend/.env`.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>

          <section className="profile-form-section surface-card">
            <div className="form-section-header">
              <img src={iconUser} alt="" aria-hidden="true" className="form-section-icon" />
              <h3 className="form-section-title">Personal Information</h3>
            </div>

            <div className="profile-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="prof-firstName">First Name</label>
                <input
                  id="prof-firstName"
                  type="text"
                  className="modal-input"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-lastName">Last Name</label>
                <input
                  id="prof-lastName"
                  type="text"
                  className="modal-input"
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  placeholder="Last name"
                />
              </div>
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="prof-email">Email Address</label>
                <input
                  id="prof-email"
                  type="email"
                  className="modal-input"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="prof-currentJob">Current Job Title</label>
                <input
                  id="prof-currentJob"
                  type="text"
                  className="modal-input"
                  value={form.currentJob}
                  onChange={(e) => handleChange('currentJob', e.target.value)}
                  placeholder="e.g. Frontend Developer"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-linkedin">LinkedIn URL</label>
                <input
                  id="prof-linkedin"
                  type="url"
                  className="modal-input"
                  value={form.linkedInUrl}
                  onChange={(e) => handleChange('linkedInUrl', e.target.value)}
                  placeholder="linkedin.com/in/yourname"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-github">GitHub URL</label>
                <input
                  id="prof-github"
                  type="url"
                  className="modal-input"
                  value={form.githubUrl}
                  onChange={(e) => handleChange('githubUrl', e.target.value)}
                  placeholder="github.com/yourname"
                />
              </div>
            </div>

            {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

            <div className="profile-form-footer">
              {saveSuccess && (
                <div className="save-success">
                  <img src={iconCheck} alt="" aria-hidden="true" className="save-success-icon" />
                  Profile saved!
                </div>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !isDirty}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
