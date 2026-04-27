import { useState, useEffect, useCallback } from 'react';
import { ENV } from '../../config';
import iconCheck from '../../assets/icon-check.svg';
import iconZap from '../../assets/icon-zap.svg';
import iconTrophy from '../../assets/icon-trophy.svg';
import iconTarget from '../../assets/icon-target.svg';
import './MySkills.css';
import type { User } from '../../types/user';

interface Achievement {
  id: string;
  name: string;
  grade: number;
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentJob?: string;
  achievements?: Achievement[];
}

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

const parseUserProfile = (data: unknown): UserProfile | null => {
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.firstName !== 'string' ||
    typeof obj.lastName !== 'string' ||
    typeof obj.email !== 'string'
  ) return null;
  const profile: UserProfile = {
    id: obj.id,
    firstName: obj.firstName,
    lastName: obj.lastName,
    email: obj.email,
  };
  if (typeof obj.currentJob === 'string') profile.currentJob = obj.currentJob;
  if (Array.isArray(obj.achievements)) {
    profile.achievements = obj.achievements.filter(
      (a): a is Achievement =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as Record<string, unknown>).id === 'string' &&
        typeof (a as Record<string, unknown>).name === 'string' &&
        typeof (a as Record<string, unknown>).grade === 'number'
    );
  }
  return profile;
};

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

const gradeColor = (grade: number): string => {
  if (grade >= 75) return 'badge-green';
  if (grade >= 50) return 'badge-yellow';
  return 'badge-red';
};

const gradeLabel = (grade: number): string => {
  if (grade >= 75) return 'Strong';
  if (grade >= 50) return 'Developing';
  return 'Needs Work';
};

export const MySkills = ({ user }: MySkillsProps) => {
  const [profileState, setProfileState] = useState<FetchState>('idle');
  const [skillState, setSkillState] = useState<FetchState>('idle');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [datasets, setDatasets] = useState<SkillDataset[]>([]);
  const [profileError, setProfileError] = useState('');
  const [skillError, setSkillError] = useState('');

  const loadProfile = useCallback(() => {
    if (!user?.id) return;
    setProfileState('loading');
    fetch(`${ENV.USERS_SERVICE_BASE_URL}/users/${user.id}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data: unknown = await res.json();
        const parsed = parseUserProfile(data);
        setProfile(parsed);
        setProfileState('success');
      })
      .catch((err: unknown) => {
        setProfileError(err instanceof Error ? err.message : 'Failed to load profile');
        setProfileState('error');
      });
  }, [user?.id]);

  const loadSkills = useCallback(() => {
    if (!user?.id) return;
    setSkillState('loading');
    fetch(`${ENV.JOB_SERVICE_BASE_URL}/skill-matcher/${user.id}`, { credentials: 'include' })
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
    loadProfile();
    loadSkills();
  }, [loadProfile, loadSkills]);

  const isLoading = profileState === 'loading' || skillState === 'loading';

  const achievements = profile?.achievements ?? [];
  const avgGrade =
    achievements.length > 0
      ? Math.round(achievements.reduce((sum, a) => sum + a.grade, 0) / achievements.length)
      : 0;

  const allSkills = datasets.flatMap((d) => d.skillToImprove);
  const skillsAssigned = allSkills.length;
  const skillsCompleted = allSkills.filter((s) => s.isDone).length;

  return (
    <div className="myskills-page">
      <div className="myskills-container">

        <div className="myskills-header">
          <h1 className="myskills-title">My Skills</h1>
          <p className="myskills-subtitle">Your achievements and skills in one place</p>
        </div>

        {isLoading && (
          <div className="page-loading">
            <div className="spinner" />
            <p>Loading your skills...</p>
          </div>
        )}

        {!isLoading && (profileState === 'error' || skillState === 'error') && (
          <div className="page-error">
            {profileState === 'error' && <p>Could not load profile: {profileError}</p>}
            {skillState === 'error' && <p>Could not load skills: {skillError}</p>}
            <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={() => { loadProfile(); loadSkills(); }}>
              Try Again
            </button>
          </div>
        )}

        {!isLoading && profileState === 'success' && skillState === 'success' && (
          <>
            <div className="myskills-stats-row">
              <div className="myskills-stat-card">
                <div className="myskills-stat-icon-wrap myskills-stat-icon-wrap--blue">
                  <img src={iconTrophy} alt="" aria-hidden="true" className="myskills-stat-icon myskills-stat-icon--blue" />
                </div>
                <div className="myskills-stat-info">
                  <span className="myskills-stat-label">Total Achievements</span>
                  <span className="myskills-stat-value">{achievements.length}</span>
                </div>
              </div>
              <div className="myskills-stat-card">
                <div className="myskills-stat-icon-wrap myskills-stat-icon-wrap--yellow">
                  <img src={iconTrophy} alt="" aria-hidden="true" className="myskills-stat-icon myskills-stat-icon--yellow" />
                </div>
                <div className="myskills-stat-info">
                  <span className="myskills-stat-label">Avg Achievement Score</span>
                  <span className="myskills-stat-value">{achievements.length > 0 ? `${avgGrade}%` : '-'}</span>
                </div>
              </div>
              <div className="myskills-stat-card">
                <div className="myskills-stat-icon-wrap myskills-stat-icon-wrap--purple">
                  <img src={iconZap} alt="" aria-hidden="true" className="myskills-stat-icon myskills-stat-icon--purple" />
                </div>
                <div className="myskills-stat-info">
                  <span className="myskills-stat-label">Skills Assigned</span>
                  <span className="myskills-stat-value">{skillsAssigned}</span>
                </div>
              </div>
              <div className="myskills-stat-card">
                <div className="myskills-stat-icon-wrap myskills-stat-icon-wrap--green">
                  <img src={iconTarget} alt="" aria-hidden="true" className="myskills-stat-icon myskills-stat-icon--green" />
                </div>
                <div className="myskills-stat-info">
                  <span className="myskills-stat-label">Skills Completed</span>
                  <span className="myskills-stat-value">{skillsCompleted}</span>
                </div>
              </div>
            </div>

            {achievements.length > 0 && (
              <section className="myskills-section">
                <h2 className="myskills-section-title">Achievements</h2>
                <div className="achievements-grid">
                  {achievements.map((ach) => (
                    <div key={ach.id} className="achievement-card surface-card">
                      <div className="achievement-card-top">
                        <span className="achievement-name">{ach.name}</span>
                        <span className={`badge ${gradeColor(ach.grade)}`}>{gradeLabel(ach.grade)}</span>
                      </div>
                      <div className="achievement-grade-label">
                        <span>Score</span>
                        <span className="achievement-grade-pct">{ach.grade}%</span>
                      </div>
                      <div className="achievement-bar-bg">
                        <div
                          className={`achievement-bar-fill achievement-bar-fill--${gradeColor(ach.grade)}`}
                          style={{ width: `${Math.min(ach.grade, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="myskills-section">
              <h2 className="myskills-section-title">Skills to Develop</h2>

              {datasets.length === 0 && (
                <div className="surface-card myskills-empty">
                  <img src={iconZap} alt="" className="myskills-empty-icon" aria-hidden="true" />
                  <p>No skills assigned yet.</p>
                </div>
              )}

              {datasets.length > 0 && (
                <div className="skillsets-list">
                  {datasets.map((dataset) => {
                    const done = dataset.skillToImprove.filter((s) => s.isDone).length;
                    const total = dataset.skillToImprove.length;
                    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                    return (
                      <div key={dataset.id} className="skillset-card surface-card">
                        <div className="skillset-header">
                          <div>
                            <h3 className="skillset-title">Job #{dataset.jobId} - Skills to Develop</h3>
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
                          {dataset.skillToImprove.length === 0 && (
                            <li className="skillset-item-empty">No skills in this set</li>
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

      </div>
    </div>
  );
};
