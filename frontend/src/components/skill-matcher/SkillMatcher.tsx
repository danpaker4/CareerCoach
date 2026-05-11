import { useState, useEffect, useCallback } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconCheck from '../../assets/icon-check.svg';
import iconZap from '../../assets/icon-zap.svg';
import iconPlus from '../../assets/icon-plus.svg';
import iconX from '../../assets/icon-x.svg';
import './SkillMatcher.css';
import type { SkillMatcherData, SkillMatcherProps, FetchState } from './skill-matcher.types';

const SKILL_MATCHER_URL = (userId: string) =>
  `${ENV.JOB_SERVICE_BASE_URL}/skill-matcher/${userId}`;

const parseSkillMatcherResponse = (data: unknown): SkillMatcherData[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is SkillMatcherData => {
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

const ProgressRing = ({ done, total }: { done: number; total: number }) => {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 75 ? 'var(--clr-success)' : pct >= 40 ? 'var(--clr-warning)' : 'var(--clr-primary)';

  return (
    <svg className="progress-ring-svg" viewBox="0 0 100 100" width="100" height="100" aria-hidden="true">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--clr-slate-200)" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={radius} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill={color}>{pct}%</text>
      <text x="50" y="60" textAnchor="middle" fontSize="9" fill="var(--clr-slate-500)">{done}/{total} done</text>
    </svg>
  );
};

export const SkillMatcher = ({ user }: SkillMatcherProps) => {
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [datasets, setDatasets] = useState<SkillMatcherData[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [addingSkillTo, setAddingSkillTo] = useState<string | null>(null);
  const [newSkillInputs, setNewSkillInputs] = useState<Record<string, string>>({});
  const [savingSkill, setSavingSkill] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!user?.id) return;
    setFetchState('loading');
    apiFetch(SKILL_MATCHER_URL(user.id), { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 404) { setDatasets([]); setFetchState('success'); return; }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data: unknown = await res.json();
        setDatasets(parseSkillMatcherResponse(data));
        setFetchState('success');
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
        setFetchState('error');
      });
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleSkill = async (dataset: SkillMatcherData, skill: string, currentDone: boolean) => {
    const key = `${dataset.id}-${skill}`;
    setTogglingSkill(key);
    try {
      await apiFetch(
        `${ENV.JOB_SERVICE_BASE_URL}/skill-matcher/${dataset.userId}/${dataset.jobId}/${encodeURIComponent(skill)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isDone: !currentDone }),
        }
      );
      setDatasets((prev) =>
        prev.map((d) =>
          d.id !== dataset.id
            ? d
            : {
                ...d,
                skillToImprove: d.skillToImprove.map((s) =>
                  s.skill === skill ? { ...s, isDone: !currentDone } : s
                ),
              }
        )
      );
    } finally {
      setTogglingSkill(null);
    }
  };

  const addSkill = async (dataset: SkillMatcherData) => {
    const skillName = (newSkillInputs[dataset.id] ?? '').trim();
    if (!skillName) return;
    const duplicate = dataset.skillToImprove.some(
      (s) => s.skill.toLowerCase() === skillName.toLowerCase()
    );
    if (duplicate) return;
    setSavingSkill(dataset.id);
    try {
      const res = await apiFetch(
        `${ENV.JOB_SERVICE_BASE_URL}/skill-matcher/${dataset.id}/skill`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ skill: skillName, isDone: false }),
        }
      );
      if (!res.ok) throw new Error('Failed to add skill');
      const updated: unknown = await res.json();
      if (
        typeof updated === 'object' &&
        updated !== null &&
        Array.isArray((updated as Record<string, unknown>).skillToImprove)
      ) {
        const updatedData = updated as SkillMatcherData;
        setDatasets((prev) =>
          prev.map((d) => (d.id === dataset.id ? updatedData : d))
        );
      }
      setNewSkillInputs((prev) => ({ ...prev, [dataset.id]: '' }));
      setAddingSkillTo(null);
    } catch {
      // silently fail
    } finally {
      setSavingSkill(null);
    }
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent, dataset: SkillMatcherData) => {
    if (e.key === 'Enter') { addSkill(dataset).catch(() => undefined); }
    if (e.key === 'Escape') { setAddingSkillTo(null); }
  };

  if (!user) {
    return (
      <div className="matcher-page">
        <div className="matcher-container">
          <div className="surface-card matcher-empty">
            <img src={iconZap} alt="" className="empty-icon" aria-hidden="true" />
            <p>Please log in to view your skill tracker.</p>
          </div>
        </div>
      </div>
    );
  }

  const allSkills = datasets.flatMap((d) => d.skillToImprove);
  const doneCount = allSkills.filter((s) => s.isDone).length;
  const remainingCount = allSkills.length - doneCount;

  return (
    <div className="matcher-page">
      <div className="matcher-container">

        <div className="matcher-header">
          <div>
            <h1 className="matcher-title">Skill Tracker</h1>
            <p className="matcher-subtitle">Skills assigned to you for improvement - check them off as you grow</p>
          </div>
        </div>

        {fetchState === 'loading' && (
          <div className="page-loading"><div className="spinner" /><p>Loading your skills...</p></div>
        )}

        {fetchState === 'error' && (
          <div className="page-error">
            <p>Could not load skills: {errorMessage}</p>
            <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={loadData}>
              Try Again
            </button>
          </div>
        )}

        {fetchState === 'success' && datasets.length === 0 && (
          <div className="surface-card matcher-empty">
            <img src={iconZap} alt="" className="empty-icon" aria-hidden="true" />
            <h2>No skills assigned yet</h2>
            <p>Your career advisor will assign skills for you to develop as part of your roadmap.</p>
          </div>
        )}

        {fetchState === 'success' && datasets.length > 0 && (
          <div className="matcher-results">

            <div className="matcher-stats-row">
              <div className="matcher-stat-card">
                <span className="matcher-stat-val">{allSkills.length}</span>
                <span className="matcher-stat-label">Total Skills</span>
              </div>
              <div className="matcher-stat-card matcher-stat-card--green">
                <span className="matcher-stat-val">{doneCount}</span>
                <span className="matcher-stat-label">Completed</span>
              </div>
              <div className="matcher-stat-card matcher-stat-card--orange">
                <span className="matcher-stat-val">{remainingCount}</span>
                <span className="matcher-stat-label">Remaining</span>
              </div>
              <div className="matcher-stat-card matcher-stat-card--purple">
                <span className="matcher-stat-val">{datasets.length}</span>
                <span className="matcher-stat-label">Skill Sets</span>
              </div>
            </div>

            <div className="matcher-overview surface-card">
              <ProgressRing done={doneCount} total={allSkills.length} />
              <div className="overview-text">
                <h2 className="overview-title">Overall Progress</h2>
                <p className="overview-sub">
                  {doneCount === allSkills.length
                    ? 'All skills completed - great work!'
                    : `${remainingCount} skill${remainingCount === 1 ? '' : 's'} remaining`}
                </p>
                {doneCount > 0 && doneCount < allSkills.length && (
                  <div className="overview-bar-wrap">
                    <div className="overview-bar-bg">
                      <div
                        className="overview-bar-fill"
                        style={{ width: `${Math.round((doneCount / allSkills.length) * 100)}%` }}
                      />
                    </div>
                    <span className="overview-bar-pct">{Math.round((doneCount / allSkills.length) * 100)}%</span>
                  </div>
                )}
              </div>
            </div>

            {datasets.map((dataset) => {
              const done = dataset.skillToImprove.filter((s) => s.isDone).length;
              const total = dataset.skillToImprove.length;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              const isAddingHere = addingSkillTo === dataset.id;
              const inputVal = newSkillInputs[dataset.id] ?? '';
              return (
                <div key={dataset.id} className="skill-set surface-card">
                  <div className="skill-set-header">
                    <div className="skill-set-header-left">
                      <h3 className="skill-set-title">Job #{dataset.jobId} - Skills to Develop</h3>
                      <p className="skill-set-sub">{done} of {total} completed</p>
                    </div>
                    <div className="skill-set-header-right">
                      <div className="skill-set-pct-badge">{pct}%</div>
                      <div className="skill-set-progress-bar-wrap">
                        <div className="skill-set-progress-bar">
                          <div
                            className="skill-set-progress-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-add-skill"
                        onClick={() => setAddingSkillTo(isAddingHere ? null : dataset.id)}
                        title="Add a skill"
                      >
                        <img src={isAddingHere ? iconX : iconPlus} alt="" aria-hidden="true" className="add-skill-icon" />
                        {isAddingHere ? 'Cancel' : 'Add Skill'}
                      </button>
                    </div>
                  </div>

                  {isAddingHere && (
                    <div className="add-skill-row">
                      <input
                        type="text"
                        className="add-skill-input"
                        placeholder="Skill name, e.g. Docker"
                        value={inputVal}
                        autoFocus
                        onChange={(e) => setNewSkillInputs((prev) => ({ ...prev, [dataset.id]: e.target.value }))}
                        onKeyDown={(e) => handleSkillKeyDown(e, dataset)}
                      />
                      <button
                        type="button"
                        className="btn-primary btn-save-skill"
                        onClick={() => addSkill(dataset).catch(() => undefined)}
                        disabled={!inputVal.trim() || savingSkill === dataset.id}
                      >
                        {savingSkill === dataset.id ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  )}

                  <ul className="skill-checklist">
                    {dataset.skillToImprove.map((s) => {
                      const key = `${dataset.id}-${s.skill}`;
                      const isToggling = togglingSkill === key;
                      return (
                        <li key={s.skill} className={`skill-item${s.isDone ? ' skill-item--done' : ''}`}>
                          <button
                            type="button"
                            className={`skill-checkbox${s.isDone ? ' skill-checkbox--checked' : ''}`}
                            onClick={() => toggleSkill(dataset, s.skill, s.isDone)}
                            disabled={isToggling}
                            aria-label={s.isDone ? `Mark ${s.skill} as not done` : `Mark ${s.skill} as done`}
                          >
                            {s.isDone && <img src={iconCheck} alt="" className="check-img" aria-hidden="true" />}
                          </button>
                          <span className="skill-name">{s.skill}</span>
                          {s.isDone && <span className="badge badge-green skill-done-badge">Done</span>}
                          {!s.isDone && <span className="badge badge-blue skill-todo-badge">To Do</span>}
                        </li>
                      );
                    })}
                    {dataset.skillToImprove.length === 0 && (
                      <li className="skill-item-empty">No skills yet - add one above</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
