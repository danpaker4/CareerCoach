import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconCheck from '../../assets/icon-check.svg';
import iconZap from '../../assets/icon-zap.svg';
import './SkillMatcher.css';
import type { CareerRoadmapData, FetchState, RoadmapSkillSet, SkillMatcherProps } from './skill-matcher.types';
import {
  buildSkillSetsFromRoadmaps,
  parseCareerRoadmaps,
  summarizeSkillProgress,
  toggleRoadmapAction,
} from './skill-matcher-from-roadmap.utils';

const ROADMAP_URL = (userId: string) =>
  `${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${userId}`;

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
  const [roadmaps, setRoadmaps] = useState<CareerRoadmapData[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!user?.id) return;
    setFetchState('loading');
    apiFetch(ROADMAP_URL(user.id), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data: unknown = await res.json();
        setRoadmaps(parseCareerRoadmaps(data));
        setFetchState('success');
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
        setFetchState('error');
      });
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const skillSets = buildSkillSetsFromRoadmaps(roadmaps);
  const { total, done, pct } = summarizeSkillProgress(skillSets);
  const remainingCount = total - done;

  const toggleCheckbox = async (skillSet: RoadmapSkillSet, action: string) => {
    const key = `${skillSet.id}:${action}`;
    const previous = roadmaps;
    const nextRoadmaps = toggleRoadmapAction({
      roadmaps,
      roadmapId: skillSet.roadmapId,
      stageIndex: skillSet.stageIndex,
      action,
    });
    const updatedRoadmap = nextRoadmaps.find((item) => item.id === skillSet.roadmapId);
    if (!updatedRoadmap) return;

    setTogglingKey(key);
    setRoadmaps(nextRoadmaps);

    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${skillSet.roadmapId}/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stagesToDreamJob: updatedRoadmap.stagesToDreamJob }),
      });
      if (!res.ok) throw new Error('Failed to update checkbox');
    } catch {
      setRoadmaps(previous);
      setErrorMessage('Could not update progress. Please try again.');
    } finally {
      setTogglingKey(null);
    }
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

  return (
    <div className="matcher-page">
      <div className="matcher-container">

        <div className="matcher-header">
          <div>
            <h1 className="matcher-title">Skill Tracker</h1>
            <p className="matcher-subtitle">
              Every roadmap checkbox in one place — track how far you&apos;ve come
            </p>
          </div>
        </div>

        {fetchState === 'loading' && (
          <div className="page-loading"><div className="spinner" /><p>Loading your roadmap checkboxes...</p></div>
        )}

        {fetchState === 'error' && (
          <div className="page-error">
            <p>Could not load skills: {errorMessage}</p>
            <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={loadData}>
              Try Again
            </button>
          </div>
        )}

        {fetchState === 'success' && skillSets.length === 0 && (
          <div className="surface-card matcher-empty">
            <img src={iconZap} alt="" className="empty-icon" aria-hidden="true" />
            <h2>No roadmap checkboxes yet</h2>
            <p>Create a career roadmap to see every milestone checkbox here with progress.</p>
            <Link to="/roadmap" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
              Go to Career Roadmap
            </Link>
          </div>
        )}

        {fetchState === 'success' && skillSets.length > 0 && (
          <div className="matcher-results">

            <div className="matcher-stats-row">
              <div className="matcher-stat-card">
                <span className="matcher-stat-val">{total}</span>
                <span className="matcher-stat-label">Total Checkboxes</span>
              </div>
              <div className="matcher-stat-card matcher-stat-card--green">
                <span className="matcher-stat-val">{done}</span>
                <span className="matcher-stat-label">Completed</span>
              </div>
              <div className="matcher-stat-card matcher-stat-card--orange">
                <span className="matcher-stat-val">{remainingCount}</span>
                <span className="matcher-stat-label">Remaining</span>
              </div>
              <div className="matcher-stat-card matcher-stat-card--purple">
                <span className="matcher-stat-val">{pct}%</span>
                <span className="matcher-stat-label">Overall Progress</span>
              </div>
            </div>

            <div className="matcher-overview surface-card">
              <ProgressRing done={done} total={total} />
              <div className="overview-text">
                <h2 className="overview-title">Overall Progress</h2>
                <p className="overview-sub">
                  {done === total
                    ? 'All roadmap checkboxes completed — great work!'
                    : `${remainingCount} checkbox${remainingCount === 1 ? '' : 'es'} remaining · ${pct}% done`}
                </p>
                {done > 0 && done < total && (
                  <div className="overview-bar-wrap">
                    <div className="overview-bar-bg">
                      <div className="overview-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="overview-bar-pct">{pct}%</span>
                  </div>
                )}
              </div>
            </div>

            {skillSets.map((skillSet) => {
              const setDone = skillSet.skillToImprove.filter((item) => item.isDone).length;
              const setTotal = skillSet.skillToImprove.length;
              const setPct = setTotal === 0 ? 0 : Math.round((setDone / setTotal) * 100);
              return (
                <div key={skillSet.id} className="skill-set surface-card">
                  <div className="skill-set-header">
                    <div className="skill-set-header-left">
                      <h3 className="skill-set-title">{skillSet.stageLabel}</h3>
                      <p className="skill-set-sub">
                        Toward {skillSet.dreamJob} · {setDone} of {setTotal} completed
                      </p>
                    </div>
                    <div className="skill-set-header-right">
                      <div className="skill-set-pct-badge">{setPct}%</div>
                      <div className="skill-set-progress-bar-wrap">
                        <div className="skill-set-progress-bar">
                          <div className="skill-set-progress-fill" style={{ width: `${setPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <ul className="skill-checklist">
                    {skillSet.skillToImprove.map((item) => {
                      const key = `${skillSet.id}:${item.skill}`;
                      const isToggling = togglingKey === key;
                      return (
                        <li key={item.skill} className={`skill-item${item.isDone ? ' skill-item--done' : ''}`}>
                          <button
                            type="button"
                            className={`skill-checkbox${item.isDone ? ' skill-checkbox--checked' : ''}`}
                            onClick={() => toggleCheckbox(skillSet, item.skill)}
                            disabled={isToggling}
                            aria-label={item.isDone ? `Mark ${item.skill} as not done` : `Mark ${item.skill} as done`}
                          >
                            {item.isDone && <img src={iconCheck} alt="" className="check-img" aria-hidden="true" />}
                          </button>
                          <span className="skill-name">{item.skill}</span>
                          {item.isDone && <span className="badge badge-green skill-done-badge">Done</span>}
                          {!item.isDone && <span className="badge badge-blue skill-todo-badge">To Do</span>}
                        </li>
                      );
                    })}
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
