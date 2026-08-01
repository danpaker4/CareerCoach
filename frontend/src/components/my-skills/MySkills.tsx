import { useState, useEffect, useCallback, useRef } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { normalizeUser } from '../../lib/authResponse';
import { connectGithubAccount } from '../../lib/githubAuth';
import iconCheck from '../../assets/icon-check.svg';
import iconZap from '../../assets/icon-zap.svg';
import iconUser from '../../assets/icon-user.svg';
import iconTarget from '../../assets/icon-target.svg';
import './MySkills.css';
import type { User } from '../../types/user';
import {
  buildSkillSetsFromRoadmaps,
  parseCareerRoadmaps,
  summarizeSkillProgress,
} from '../skill-matcher/skill-matcher-from-roadmap.utils';
import type { RoadmapSkillSet } from '../skill-matcher/skill-matcher.types';

interface MySkillsProps {
  user: User;
  onUserUpdated?: (updated: User) => void;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';
const GITHUB_PROJECT_COUNT_SKILL_SUFFIX = ' github projects';
const USERS_URL = (userId: string) => `${ENV.USERS_SERVICE_BASE_URL}/users/${userId}`;

const uniqueTrimmedStrings = (items: readonly string[]): string[] =>
  [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];

export const MySkills = ({ user, onUserUpdated }: MySkillsProps) => {
  const [profileUser, setProfileUser] = useState<User>(user);
  const [skillState, setSkillState] = useState<FetchState>('idle');
  const [skillSets, setSkillSets] = useState<RoadmapSkillSet[]>([]);
  const [skillError, setSkillError] = useState('');
  const onUserUpdatedRef = useRef(onUserUpdated);
  onUserUpdatedRef.current = onUserUpdated;

  const achievements = profileUser.achievements ?? [];
  const cvSkills = achievements.map((achievement) => achievement.name);
  const chatTechnologies = uniqueTrimmedStrings(profileUser.technologies ?? []);
  const chatKnownSkills = uniqueTrimmedStrings(profileUser.knownSkills ?? []);
  const chatSkills = uniqueTrimmedStrings([...chatTechnologies, ...chatKnownSkills]);
  const githubSkills = [...new Set((profileUser.githubSkills ?? []).filter((skill) => {
    const normalizedSkill = skill.trim();
    return normalizedSkill.length > 0 && !normalizedSkill.toLowerCase().endsWith(GITHUB_PROJECT_COUNT_SKILL_SUFFIX);
  }))];
  const hasGithubProfile = Boolean(profileUser.githubUrl) || githubSkills.length > 0;
  const githubOauthConfigured = Boolean(ENV.GITHUB_CLIENT_ID);

  const loadSkills = useCallback(() => {
    if (!user.id) return;
    setSkillState('loading');
    apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${user.id}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data: unknown = await res.json();
        setSkillSets(buildSkillSetsFromRoadmaps(parseCareerRoadmaps(data)));
        setSkillState('success');
      })
      .catch((err: unknown) => {
        setSkillError(err instanceof Error ? err.message : 'Failed to load skills');
        setSkillState('error');
      });
  }, [user.id]);

  useEffect(() => {
    if (!user.id) return;

    apiFetch(USERS_URL(user.id), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const payload: unknown = await res.json();
        const refreshed = normalizeUser(payload);
        if (!refreshed) return;
        setProfileUser(refreshed);
        onUserUpdatedRef.current?.(refreshed);
      })
      .catch(() => undefined);

    loadSkills();
  }, [user.id, loadSkills]);

  const { total: allSkillsCount, done: skillsCompleted, pct: overallPct } = summarizeSkillProgress(skillSets);

  return (
    <div className="myskills-page">
      <div className="myskills-container">
        <div className="myskills-header">
          <h1 className="myskills-title">My Skills</h1>
          <p className="myskills-subtitle">Skills from your CV, chat, GitHub and roadmap checkboxes</p>
        </div>

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
                {profileUser.cv
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

        <section className="myskills-section">
          <div className="myskills-section-header">
            <img src={iconTarget} alt="" aria-hidden="true" className="section-icon section-icon--green" />
            <h2 className="myskills-section-title">Skills from chat</h2>
            {chatSkills.length > 0 && <span className="myskills-section-count">{chatSkills.length}</span>}
          </div>

          {chatSkills.length === 0 ? (
            <div className="surface-card myskills-empty">
              <img src={iconTarget} alt="" className="myskills-empty-icon" aria-hidden="true" />
              <p>Chat with the coach about tools and experience to extract skills here.</p>
            </div>
          ) : (
            <div className="skill-chips-wrap surface-card">
              {chatTechnologies.map((skill) => (
                <span key={`tech-${skill}`} className="skill-chip skill-chip--green">{skill}</span>
              ))}
              {chatKnownSkills.map((skill) => (
                <span key={`known-${skill}`} className="skill-chip skill-chip--orange">{skill}</span>
              ))}
            </div>
          )}
        </section>

        <section className="myskills-section">
          <div className="myskills-section-header">
            <img src={iconUser} alt="" aria-hidden="true" className="section-icon section-icon--purple" />
            <h2 className="myskills-section-title">Skills from GitHub</h2>
            {githubSkills.length > 0 && <span className="myskills-section-count">{githubSkills.length}</span>}
          </div>

          {!hasGithubProfile && (
            <div className="surface-card myskills-empty">
              <p>Connect your GitHub account to extract programming skills from your repositories.</p>
              <button
                type="button"
                className="btn-outline myskills-connect-btn"
                onClick={() => connectGithubAccount('profile')}
                disabled={!githubOauthConfigured}
              >
                Connect GitHub
              </button>
              {!githubOauthConfigured && (
                <p className="myskills-connect-note">GitHub OAuth is not configured. Set `VITE_CLIENT_ID` in `frontend/.env`.</p>
              )}
            </div>
          )}

          {hasGithubProfile && githubSkills.length === 0 && (
            <div className="surface-card myskills-empty">
              <p>No GitHub skills found yet. Reconnect GitHub or refresh your imported profile data.</p>
            </div>
          )}

          {hasGithubProfile && githubSkills.length > 0 && (
            <div className="skill-chips-wrap surface-card">
              {githubSkills.map((skill) => (
                <span key={skill} className="skill-chip skill-chip--purple">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="myskills-section">
          <div className="myskills-section-header">
            <img src={iconTarget} alt="" aria-hidden="true" className="section-icon section-icon--green" />
            <h2 className="myskills-section-title">Roadmap checkboxes</h2>
            {allSkillsCount > 0 && (
              <span className="myskills-section-count">{skillsCompleted}/{allSkillsCount} · {overallPct}%</span>
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

          {skillState === 'success' && skillSets.length === 0 && (
            <div className="surface-card myskills-empty">
              <img src={iconZap} alt="" className="myskills-empty-icon" aria-hidden="true" />
              <p>No roadmap checkboxes yet. Create a career roadmap to track progress here.</p>
            </div>
          )}

          {skillState === 'success' && skillSets.length > 0 && (
            <div className="skillsets-list">
              {skillSets.map((skillSet) => {
                const done = skillSet.skillToImprove.filter((skill) => skill.isDone).length;
                const total = skillSet.skillToImprove.length;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);

                return (
                  <div key={skillSet.id} className="skillset-card surface-card">
                    <div className="skillset-header">
                      <div>
                        <h3 className="skillset-title">{skillSet.stageLabel}</h3>
                        <p className="skillset-sub">Toward {skillSet.dreamJob} · {done} of {total} completed</p>
                      </div>
                      <div className="skillset-pct-wrap">
                        <span className="skillset-pct-badge">{pct}%</span>
                        <div className="skillset-progress-bar-bg">
                          <div className="skillset-progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                    <ul className="skillset-checklist">
                      {skillSet.skillToImprove.map((skill) => (
                        <li key={skill.skill} className={`skillset-item${skill.isDone ? ' skillset-item--done' : ''}`}>
                          <span className={`skillset-checkbox${skill.isDone ? ' skillset-checkbox--checked' : ''}`}>
                            {skill.isDone && <img src={iconCheck} alt="" aria-hidden="true" className="skillset-check-img" />}
                          </span>
                          <span className="skillset-skill-name">{skill.skill}</span>
                          {skill.isDone
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
