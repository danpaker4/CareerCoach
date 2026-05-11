import { useState, useEffect, useCallback } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { connectGithubAccount } from '../../lib/githubAuth';
import iconCheck from '../../assets/icon-check.svg';
import iconZap from '../../assets/icon-zap.svg';
import iconUser from '../../assets/icon-user.svg';
import iconTarget from '../../assets/icon-target.svg';
import './MySkills.css';
import type { User } from '../../types/user';

interface SkillToImprove {
  skill: string;
  isDone: boolean;
}

interface SkillDataset {
  id: string;
  userId: string;
  jobId: number;
  skillToImprove: SkillToImprove[];
}

interface MySkillsProps {
  user: User;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const parseSkillDatasets = (data: unknown): SkillDataset[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is SkillDataset => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.userId === 'string' &&
      typeof obj.jobId === 'number' &&
      Array.isArray(obj.skillToImprove)
    );
  });
};

const extractGithubUsername = (githubUrl: string | undefined): string | null => {
  if (!githubUrl) return null;
  try {
    const url = new URL(githubUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] ?? null;
  } catch {
    return null;
  }
};

const parseGithubLanguages = (repos: unknown): Record<string, number> => {
  if (!Array.isArray(repos)) return {};
  const counts: Record<string, number> = {};
  for (const repo of repos) {
    if (typeof repo !== 'object' || repo === null) continue;
    const r = repo as Record<string, unknown>;
    if (typeof r.language === 'string' && r.language) {
      counts[r.language] = (counts[r.language] ?? 0) + 1;
    }
  }
  return counts;
};

export const MySkills = ({ user }: MySkillsProps) => {
  const [skillState, setSkillState] = useState<FetchState>('idle');
  const [datasets, setDatasets] = useState<SkillDataset[]>([]);
  const [skillError, setSkillError] = useState('');
  const [githubLanguages, setGithubLanguages] = useState<Record<string, number>>({});
  const [githubState, setGithubState] = useState<FetchState>('idle');

  // Achievements from CV extraction (Gemini) - stored on user object at registration
  const achievements = user.achievements ?? [];
  const cvSkills = achievements.map((a) => a.name);

  const loadSkills = useCallback(() => {
    if (!user?.id) return;
    setSkillState('loading');
    apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/skill-matcher/${user.id}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 404) { setDatasets([]); setSkillState('success'); return; }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data: unknown = await res.json();
        setDatasets(parseSkillDatasets(data));
        setSkillState('success');
      })
      .catch((err: unknown) => {
        setSkillError(err instanceof Error ? err.message : 'Failed to load skills');
        setSkillState('error');
      });
  }, [user?.id]);

  useEffect(() => {
    loadSkills();
    const username = extractGithubUsername(user.githubUrl);
    if (username) {
      setGithubState('loading');
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`)
        .then(async (res) => {
          if (!res.ok) throw new Error('GitHub API error');
          const data: unknown = await res.json();
          setGithubLanguages(parseGithubLanguages(data));
          setGithubState('success');
        })
        .catch(() => setGithubState('error'));
    }
  }, [loadSkills, user.githubUrl]);

  const allSkills = datasets.flatMap((d) => d.skillToImprove);
  const skillsCompleted = allSkills.filter((s) => s.isDone).length;

  const sortedLanguages = Object.entries(githubLanguages).sort((a, b) => b[1] - a[1]);
  const githubOauthConfigured = Boolean(ENV.GITHUB_CLIENT_ID);

  return (
    <div className="myskills-page">
      <div className="myskills-container">

        <div className="myskills-header">
          <h1 className="myskills-title">My Skills</h1>
          <p className="myskills-subtitle">Skills from your CV, GitHub and assigned tracker</p>
        </div>

        {/* CV Skills */}
        <section className="myskills-section">
          <div className="myskills-section-header">
            <img src={iconZap} alt="" aria-hidden="true" className="section-icon section-icon--blue" />
            <h2 className="myskills-section-title">Skills from CV</h2>
            {cvSkills.length > 0 && <span className="myskills-section-count">{cvSkills.length}</span>}
          </div>

          {cvSkills.length === 0 ? (
            <div className="surface-card myskills-empty">
              <img src={iconZap} alt="" className="myskills-empty-icon" aria-hidden="true" />
              <p>
                {user.cv
                  ? 'No skills extracted yet - make sure the AI service is configured.'
                  : 'Upload your CV on the Profile page to extract skills automatically.'}
              </p>
            </div>
          ) : (
            <div className="skill-chips-wrap surface-card">
              {cvSkills.map((skill) => (
                <span key={skill} className="skill-chip skill-chip--blue">{skill}</span>
              ))}
            </div>
          )}
        </section>

        {/* GitHub Skills */}
        <section className="myskills-section">
          <div className="myskills-section-header">
            <img src={iconUser} alt="" aria-hidden="true" className="section-icon section-icon--purple" />
            <h2 className="myskills-section-title">Skills from GitHub</h2>
            {sortedLanguages.length > 0 && <span className="myskills-section-count">{sortedLanguages.length}</span>}
          </div>

          {!user.githubUrl && (
            <div className="surface-card myskills-empty">
              <p>Connect your GitHub account to extract programming skills from your repositories.</p>
              <button
                type="button"
                className="btn-outline myskills-connect-btn"
                onClick={connectGithubAccount}
                disabled={!githubOauthConfigured}
              >
                Connect GitHub
              </button>
              {!githubOauthConfigured && (
                <p className="myskills-connect-note">GitHub OAuth is not configured. Set `VITE_CLIENT_ID` in `frontend/.env`.</p>
              )}
            </div>
          )}

          {user.githubUrl && githubState === 'loading' && (
            <div className="page-loading"><div className="spinner" /><p>Fetching GitHub repos...</p></div>
          )}

          {user.githubUrl && githubState === 'error' && (
            <div className="surface-card myskills-empty">
              <p>Could not load GitHub data - profile may be private.</p>
            </div>
          )}

          {user.githubUrl && githubState === 'success' && sortedLanguages.length === 0 && (
            <div className="surface-card myskills-empty">
              <p>No public repos found on GitHub.</p>
            </div>
          )}

          {user.githubUrl && githubState === 'success' && sortedLanguages.length > 0 && (
            <div className="skill-chips-wrap surface-card">
              {sortedLanguages.map(([lang, count]) => (
                <span key={lang} className="skill-chip skill-chip--purple">
                  {lang}
                  <span className="skill-chip-count">{count}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Assigned Skills from Skill Tracker */}
        <section className="myskills-section">
          <div className="myskills-section-header">
            <img src={iconTarget} alt="" aria-hidden="true" className="section-icon section-icon--green" />
            <h2 className="myskills-section-title">Skills to Develop</h2>
            {allSkills.length > 0 && (
              <span className="myskills-section-count">{skillsCompleted}/{allSkills.length}</span>
            )}
          </div>

          {skillState === 'loading' && (
            <div className="page-loading"><div className="spinner" /><p>Loading skills...</p></div>
          )}

          {skillState === 'error' && (
            <div className="page-error">
              <p>Could not load skills: {skillError}</p>
              <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={loadSkills}>
                Try Again
              </button>
            </div>
          )}

          {skillState === 'success' && datasets.length === 0 && (
            <div className="surface-card myskills-empty">
              <img src={iconZap} alt="" className="myskills-empty-icon" aria-hidden="true" />
              <p>No skills assigned yet. Visit the Skill Tracker to add skills.</p>
            </div>
          )}

          {skillState === 'success' && datasets.length > 0 && (
            <div className="skillsets-list">
              {datasets.map((dataset) => {
                const done = dataset.skillToImprove.filter((s) => s.isDone).length;
                const total = dataset.skillToImprove.length;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                return (
                  <div key={dataset.id} className="skillset-card surface-card">
                    <div className="skillset-header">
                      <div>
                        <h3 className="skillset-title">Job #{dataset.jobId}</h3>
                        <p className="skillset-sub">{done} of {total} completed</p>
                      </div>
                      <div className="skillset-pct-wrap">
                        <span className="skillset-pct-badge">{pct}%</span>
                        <div className="skillset-progress-bar-bg">
                          <div className="skillset-progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                    <ul className="skillset-checklist">
                      {dataset.skillToImprove.map((s) => (
                        <li key={s.skill} className={`skillset-item${s.isDone ? ' skillset-item--done' : ''}`}>
                          <span className={`skillset-checkbox${s.isDone ? ' skillset-checkbox--checked' : ''}`}>
                            {s.isDone && <img src={iconCheck} alt="" aria-hidden="true" className="skillset-check-img" />}
                          </span>
                          <span className="skillset-skill-name">{s.skill}</span>
                          {s.isDone
                            ? <span className="badge badge-green">Done</span>
                            : <span className="badge badge-blue">To Do</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};
