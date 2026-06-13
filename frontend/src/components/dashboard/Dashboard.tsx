import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconRoadmap from '../../assets/icon-roadmap.svg';
import iconZap from '../../assets/icon-zap.svg';
import iconKanban from '../../assets/icon-kanban.svg';
import iconUser from '../../assets/icon-user.svg';
import iconTarget from '../../assets/icon-target.svg';
import iconSparkle from '../../assets/icon-sparkle.svg';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import type { User } from '../../types/user';
import './Dashboard.css';

interface DashboardProps {
  user: User;
}

interface QuickStats {
  roadmapPct: number | null;
  skills: number | null;
  skillsDone: number | null;
  jobs: number | null;
}

const computeRoadmapProgress = (data: unknown): number | null => {
  if (!Array.isArray(data) || data.length === 0) return null;
  let totalStages = 0;
  let progressSum = 0;
  for (const roadmap of data) {
    const stages = (roadmap as { stagesToDreamJob?: unknown }).stagesToDreamJob;
    if (!Array.isArray(stages)) continue;
    for (const stage of stages) {
      const s = stage as { isDone?: boolean; content?: { actions?: unknown }; completedActions?: unknown };
      totalStages += 1;
      if (s.isDone) {
        progressSum += 1;
        continue;
      }
      const actions = Array.isArray(s.content?.actions) ? (s.content?.actions as string[]) : [];
      if (actions.length === 0) continue;
      const completed = Array.isArray(s.completedActions) ? (s.completedActions as string[]) : [];
      const doneCount = completed.filter((action) => actions.includes(action)).length;
      progressSum += doneCount / actions.length;
    }
  }
  if (totalStages === 0) return 0;
  return Math.round((progressSum / totalStages) * 100);
};

const getInitials = (u: User) =>
  (u.firstName.charAt(0) + u.lastName.charAt(0)).toUpperCase();

const getTimeGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const FEATURE_CARDS = [
  {
    id: 'roadmap',
    route: '/roadmap',
    title: 'Career Roadmap',
    description: 'Track your personalized path to your dream role. See completed milestones and what comes next.',
    icon: iconRoadmap,
    colorClass: 'dash-card--blue',
    statKey: 'roadmapPct' as keyof QuickStats,
    statLabel: 'complete',
  },
  {
    id: 'skills',
    route: '/skill-matcher',
    title: 'Skill Tracker',
    description: 'Check off skills as you learn them. See your progress toward each job requirement.',
    icon: iconZap,
    colorClass: 'dash-card--purple',
    statKey: 'skills' as keyof QuickStats,
    statLabel: 'skills to develop',
  },
  {
    id: 'pipeline',
    route: '/pipeline',
    title: 'My Pipeline',
    description: 'Manage every job application from wishlist to offer in one kanban board.',
    icon: iconKanban,
    colorClass: 'dash-card--green',
    statKey: 'jobs' as keyof QuickStats,
    statLabel: 'jobs tracked',
  },
  {
    id: 'myskills',
    route: '/my-skills',
    title: 'My Skills',
    description: 'View all your achievements and skill progress in one place. See grades and completion rates.',
    icon: iconTarget,
    colorClass: 'dash-card--teal',
    statKey: 'skills' as keyof QuickStats,
    statLabel: 'skills tracked',
  },
  {
    id: 'jobs',
    route: '/job-suggestions',
    title: 'Job Suggestions',
    description: 'Browse job listings matched to your skills with a percentage fit score.',
    icon: iconSparkle,
    colorClass: 'dash-card--indigo',
    statKey: null,
    statLabel: '',
  },
  {
    id: 'profile',
    route: '/profile',
    title: 'My Profile',
    description: 'Keep your details up to date - name, current role, LinkedIn and GitHub links.',
    icon: iconUser,
    colorClass: 'dash-card--orange',
    statKey: null,
    statLabel: '',
  },
] as const;

export const Dashboard = ({ user }: DashboardProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<QuickStats>({
    roadmapPct: null,
    skills: null,
    skillsDone: null,
    jobs: null,
  });

  useEffect(() => {
    const headers = { credentials: 'include' as const };

    const fetchRoadmaps = apiFetch(
      `${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${user.id}`, headers
    ).then(async (r) => {
      if (!r.ok) return null;
      const d: unknown = await r.json();
      return computeRoadmapProgress(d);
    }).catch(() => null);

    const fetchSkills = apiFetch(
      `${ENV.JOB_SERVICE_BASE_URL}/skill-matcher/${user.id}`, headers
    ).then(async (r) => {
      if (!r.ok) return null;
      const d = await r.json() as Array<{ skillToImprove: Array<{ isDone: boolean }> }>;
      if (!Array.isArray(d)) return null;
      const allSkills = d.flatMap((ds) => ds.skillToImprove);
      return { total: allSkills.length, done: allSkills.filter((s) => s.isDone).length };
    }).catch(() => null);

    const fetchJobs = apiFetch(
      `${ENV.JOB_SERVICE_BASE_URL}/jobs-in-pipeline/${user.id}`, headers
    ).then(async (r) => {
      if (r.status === 404) return 0;
      if (!r.ok) return null;
      const d = await r.json() as unknown[];
      return Array.isArray(d) ? d.length : null;
    }).catch(() => null);

    Promise.all([fetchRoadmaps, fetchSkills, fetchJobs]).then(
      ([roadmapPct, skillsResult, jobs]) => {
        setStats({
          roadmapPct: typeof roadmapPct === 'number' ? roadmapPct : null,
          skills: skillsResult && typeof skillsResult === 'object' ? skillsResult.total : null,
          skillsDone: skillsResult && typeof skillsResult === 'object' ? skillsResult.done : null,
          jobs: typeof jobs === 'number' ? jobs : null,
        });
      }
    );
  }, [user.id]);

  const getStatDisplay = (card: typeof FEATURE_CARDS[number]): string | null => {
    if (!card.statKey) return null;
    const val = stats[card.statKey];
    if (val === null) return null;
    if (card.statKey === 'roadmapPct') return `${val}% complete`;
    return `${val} ${card.statLabel}`;
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">

        <div className="dashboard-welcome">
          <div className="welcome-avatar">{getInitials(user)}</div>
          <div className="welcome-text">
            <p className="welcome-greeting">{getTimeGreeting()},</p>
            <h1 className="welcome-name">{user.firstName} {user.lastName}</h1>
            {user.currentJob && (
              <p className="welcome-role">{user.currentJob}</p>
            )}
          </div>
        </div>

        {(stats.roadmapPct !== null || stats.skills !== null || stats.jobs !== null) && (
          <div className="dashboard-stats-bar">
            {stats.roadmapPct !== null && (
              <div className="dash-stat">
                <span className="dash-stat-val">{stats.roadmapPct}%</span>
                <span className="dash-stat-lbl">Roadmap Done</span>
              </div>
            )}
            {stats.skills !== null && (
              <div className="dash-stat">
                <span className="dash-stat-val">{stats.skillsDone ?? 0}/{stats.skills}</span>
                <span className="dash-stat-lbl">Skills Done</span>
              </div>
            )}
            {stats.jobs !== null && (
              <div className="dash-stat">
                <span className="dash-stat-val">{stats.jobs}</span>
                <span className="dash-stat-lbl">Jobs Tracked</span>
              </div>
            )}
          </div>
        )}

        <h2 className="dashboard-section-title">Where would you like to start?</h2>

        <div className="dashboard-cards">
          {FEATURE_CARDS.map((card, i) => {
            const statText = getStatDisplay(card);
            return (
              <button
                key={card.id}
                type="button"
                className={`dash-card ${card.colorClass} animate-fade-in-up delay-${i * 100}`}
                onClick={() => navigate(card.route)}
              >
                <div className="dash-card-icon-wrap">
                  <img src={card.icon} alt="" aria-hidden="true" className="dash-card-icon" />
                </div>
                <div className="dash-card-body">
                  <h3 className="dash-card-title">{card.title}</h3>
                  <p className="dash-card-desc">{card.description}</p>
                  {statText && (
                    <span className="dash-card-stat">{statText}</span>
                  )}
                </div>
                <img src={iconArrowRight} alt="" aria-hidden="true" className="dash-card-arrow" />
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};
