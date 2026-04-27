import { useState, useEffect, useCallback } from 'react';
import { ENV } from '../../config';
import iconUser from '../../assets/icon-user.svg';
import iconBriefcase from '../../assets/icon-briefcase.svg';
import iconCheck from '../../assets/icon-check.svg';
import type { User } from '../../types/user';
import './Profile.css';

interface ProfileProps {
  user: User;
  onUserUpdated: (updated: User) => void;
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

const getInitials = (firstName: string, lastName: string): string =>
  (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();

export const Profile = ({ user, onUserUpdated }: ProfileProps) => {
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

  const loadProfile = useCallback(() => {
    fetch(USERS_URL(user.id), { credentials: 'include' })
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

      const res = await fetch(USERS_URL(user.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save changes');
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

  const initials = getInitials(form.firstName || user.firstName, form.lastName || user.lastName);
  const displayName = `${form.firstName || user.firstName} ${form.lastName || user.lastName}`.trim();

  return (
    <div className="profile-page">
      <main className="profile-container">

        <div className="profile-header">
          <div>
            <h1 className="profile-title">My Profile</h1>
            <p className="profile-subtitle">Manage your personal information</p>
          </div>
        </div>

        <div className="profile-layout">

          {/* Left — Avatar card */}
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
          </aside>

          {/* Right — Edit form */}
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
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};
