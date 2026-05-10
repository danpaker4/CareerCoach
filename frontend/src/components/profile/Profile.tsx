import { useState, useEffect, useCallback, useRef } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconUser from '../../assets/icon-user.svg';
import iconBriefcase from '../../assets/icon-briefcase.svg';
import iconCheck from '../../assets/icon-check.svg';
import iconZap from '../../assets/icon-zap.svg';
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

interface ExtractedAchievement {
  id: string;
  name: string;
  grade: number;
}

const USERS_URL = (userId: string) => `${ENV.USERS_SERVICE_BASE_URL}/users/${userId}`;

const getInitials = (firstName: string, lastName: string): string =>
  (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();

const GEMINI_PROMPT = `
You are analyzing a CV. Extract professional skills and achievements.
Return ONLY valid JSON with no markdown, no explanation.

Format:
{
  "achievements": [
    { "name": "skill or achievement name (short, max 6 words)", "grade": <number 1-100> }
  ]
}

Rules:
- Extract technical skills, tools, frameworks, languages the candidate has used
- Extract measurable achievements (led X, built X, reduced X by Y%)
- grade = proficiency estimate: 90+ for primary/expert skills, 70-89 for intermediate, 50-69 for basic, below 50 for mentioned only
- Return 5 to 20 items
- Names must be in English
`.trim();

const extractSkillsFromPdf = async (file: File): Promise<ExtractedAchievement[]> => {
  const apiKey = ENV.GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY not set in .env');

  // Step 1: upload file to Gemini Files API
  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'X-Goog-Upload-Protocol': 'multipart' },
      body: (() => {
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ file: { mimeType: 'application/pdf' } })], { type: 'application/json' }));
        form.append('file', file, file.name);
        return form;
      })(),
    }
  );

  if (!uploadRes.ok) throw new Error('Failed to upload PDF to Gemini');
  const uploadData = await uploadRes.json() as { file?: { uri?: string } };
  const fileUri = uploadData?.file?.uri;
  if (!fileUri) throw new Error('Gemini did not return a file URI');

  // Step 2: ask Gemini to extract skills
  const genRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: GEMINI_PROMPT },
            { fileData: { mimeType: 'application/pdf', fileUri } },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (!genRes.ok) throw new Error('Gemini extraction failed');
  const genData = await genRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = genData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip possible markdown code fences
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as { achievements?: Array<{ name?: string; grade?: number }> };

  return (parsed.achievements ?? [])
    .filter((a) => typeof a.name === 'string' && typeof a.grade === 'number')
    .map((a) => ({
      id: crypto.randomUUID(),
      name: a.name as string,
      grade: Math.min(100, Math.max(1, Math.round(a.grade as number))),
    }));
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

  const handleCvExtract = async () => {
    if (!cvFile) return;
    setCvExtracting(true);
    setCvError('');
    setCvSuccess(false);
    try {
      const achievements = await extractSkillsFromPdf(cvFile);
      if (achievements.length === 0) throw new Error('No skills could be extracted from this PDF');

      // Patch the user with extracted achievements
      const res = await apiFetch(USERS_URL(user.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ achievements }),
      });
      if (!res.ok) throw new Error('Failed to save skills');

      onUserUpdated({ ...user, achievements });
      setCvSkillCount(achievements.length);
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

          {/* Left - Avatar card */}
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

            {/* CV Upload Card */}
            <div className="cv-card surface-card">
              <div className="cv-card-header">
                <img src={iconZap} alt="" aria-hidden="true" className="cv-card-icon" />
                <h3 className="cv-card-title">Skills from CV</h3>
              </div>
              <p className="cv-card-sub">
                Upload your CV to automatically extract your skills and achievements using AI.
              </p>

              {user.achievements && user.achievements.length > 0 && (
                <p className="cv-card-current">
                  {user.achievements.length} skills currently extracted
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
              <label htmlFor="cv-upload" className="cv-file-label">
                {cvFile ? cvFile.name : 'Choose PDF file'}
              </label>

              {cvError && <p className="cv-error">{cvError}</p>}
              {cvSuccess && (
                <p className="cv-success">
                  <img src={iconCheck} alt="" aria-hidden="true" />
                  {cvSkillCount} skills extracted successfully!
                </p>
              )}

              <button
                type="button"
                className="btn-primary cv-extract-btn"
                onClick={handleCvExtract}
                disabled={!cvFile || cvExtracting}
              >
                {cvExtracting ? 'Extracting...' : 'Extract Skills'}
              </button>
            </div>
          </aside>

          {/* Right - Edit form */}
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
