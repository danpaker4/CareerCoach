import { useState, useEffect, useRef } from 'react';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { normalizeUser } from '../../lib/authResponse';
import { connectGithubAccount } from '../../lib/githubAuth';
import iconZap from '../../assets/icon-zap.svg';
import iconUser from '../../assets/icon-user.svg';
import iconTarget from '../../assets/icon-target.svg';
import './MySkills.css';
import type { User } from '../../types/user';

interface MySkillsProps {
  user: User;
  onUserUpdated?: (updated: User) => void;
}

const GITHUB_PROJECT_COUNT_SKILL_SUFFIX = ' github projects';
const USERS_URL = (userId: string) => `${ENV.USERS_SERVICE_BASE_URL}/users/${userId}`;

const uniqueTrimmedStrings = (items: readonly string[]): string[] =>
  [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];

export const MySkills = ({ user, onUserUpdated }: MySkillsProps) => {
  const [profileUser, setProfileUser] = useState<User>(user);
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
  }, [user.id]);

  return (
    <div className="myskills-page">
      <div className="myskills-container">
        <div className="myskills-header">
          <h1 className="myskills-title">My Skills</h1>
          <p className="myskills-subtitle">Skills from your CV, chat, and GitHub</p>
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
      </div>
    </div>
  );
};
