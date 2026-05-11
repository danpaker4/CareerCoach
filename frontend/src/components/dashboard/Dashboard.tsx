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
  roadmaps: number | null;
  skills: number | null;
  skillsDone: number | null;
  jobs: number | null;
}

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
    statKey: 'roadmaps' as keyof QuickStats,
    statLabel: 'active roadmaps',
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
    roadmaps: null,
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
      const d = await r.json() as unknown[];
      return Array.isArray(d) ? d.length : null;
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
      ([roadmaps, skillsResult, jobs]) => {
        setStats({
          roadmaps: typeof roadmaps === 'number' ? roadmaps : null,
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

        {(stats.roadmaps !== null || stats.skills !== null || stats.jobs !== null) && (
          <div className="dashboard-stats-bar">
            {stats.roadmaps !== null && (
              <div className="dash-stat">
                <span className="dash-stat-val">{stats.roadmaps}</span>
                <span className="dash-stat-lbl">Roadmaps</span>
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
