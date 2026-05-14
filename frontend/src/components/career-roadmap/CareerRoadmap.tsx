import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateRoadmapModal } from './CreateRoadmapModal';
import { ChatInterface } from '../chat-component/Chat';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconChart from '../../assets/icon-chart.svg';
import iconTrophy from '../../assets/icon-trophy.svg';
import iconList from '../../assets/icon-list.svg';
import iconMessage from '../../assets/icon-message.svg';
import iconCheck from '../../assets/icon-check.svg';
import iconPlus from '../../assets/icon-plus.svg';
import './CareerRoadmap.css';
import type { CareerRoadmapData, CareerRoadmapProps, FetchState } from './career-roadmap.types';

const ROADMAP_URL = (userId: string) =>
  `${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${userId}`;

const parseRoadmapResponse = (data: unknown): CareerRoadmapData[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is CareerRoadmapData => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.dreamJob === 'string' &&
      Array.isArray(obj.stagesToDreamJob)
    );
  });
};

const loadDefaultChatConversationId = async (userId: string): Promise<string | null> => {
  const listRes = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/users/${encodeURIComponent(userId)}/conversations`);
  if (listRes.ok) {
    const data: unknown = await listRes.json();
    if (typeof data === 'object' && data !== null && 'conversations' in data) {
      const list = (data as { conversations: unknown }).conversations;
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        if (typeof first === 'object' && first !== null && 'conversationId' in first) {
          const id = (first as { conversationId: unknown }).conversationId;
          if (typeof id === 'string' && id.trim().length > 0) {
            return id;
          }
        }
      }
    }
  }
  const convRes = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/${encodeURIComponent(userId)}`);
  if (!convRes.ok) {
    return null;
  }
  const conv: unknown = await convRes.json();
  if (typeof conv === 'object' && conv !== null && 'conversationId' in conv) {
    const id = (conv as { conversationId: unknown }).conversationId;
    if (typeof id === 'string' && id.trim().length > 0) {
      return id;
    }
  }
  return null;
};

const STEP_CONTENT = [
  {
    label: 'Foundation & Fundamentals',
    description: 'Build the core skills and knowledge base required for your target role. Focus on essential technologies, tools, and industry practices.',
    actions: ['Master core programming fundamentals', 'Complete foundational courses or certifications', 'Build small practice projects', 'Learn industry-standard development tools'],
  },
  {
    label: 'Intermediate Growth',
    description: 'Apply your knowledge on real projects and deepen your technical expertise. Start building a portfolio that demonstrates your growing capabilities.',
    actions: ['Contribute to real-world projects', 'Build a portfolio with meaningful use cases', 'Learn testing, CI/CD, and best practices', 'Collaborate and get code review feedback'],
  },
  {
    label: 'Advanced Proficiency',
    description: 'Develop deep expertise in your domain and tackle complex engineering challenges. Become a reliable resource for technical decisions.',
    actions: ['Solve complex architectural problems', 'Lead technical discussions and design reviews', 'Mentor junior developers on best practices', 'Study advanced patterns and system design'],
  },
  {
    label: 'Leadership & Expertise',
    description: 'Lead technical initiatives and drive impactful decisions. Your experience and judgment shape the direction of projects and teams.',
    actions: ['Lead cross-functional technical projects', 'Drive architecture and tooling decisions', 'Build and grow high-performing team members', 'Contribute to engineering roadmaps and OKRs'],
  },
  {
    label: 'Final Stretch',
    description: 'The last steps before reaching your dream role. Polish your skills, strengthen your network, and position yourself as a standout candidate.',
    actions: ['Prepare thoroughly for senior-level interviews', 'Build and nurture your professional network', 'Refine your portfolio and personal brand', 'Apply to your top target companies'],
  },
];

export const CareerRoadmap = ({ user }: CareerRoadmapProps) => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [roadmaps, setRoadmaps] = useState<CareerRoadmapData[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [floatingChatConversationId, setFloatingChatConversationId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!user?.id) return;
    setFetchState('loading');
    apiFetch(ROADMAP_URL(user.id), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data: unknown = await res.json();
        setRoadmaps(parseRoadmapResponse(data));
        setFetchState('success');
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
        setFetchState('error');
      });
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!isChatOpen || !user?.id) {
      return;
    }
    let cancelled = false;
    loadDefaultChatConversationId(user.id)
      .then((id) => {
        if (!cancelled) {
          setFloatingChatConversationId(id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFloatingChatConversationId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isChatOpen, user?.id]);

  // Keep active tab in bounds when roadmaps change
  useEffect(() => {
    if (activeTab >= roadmaps.length && roadmaps.length > 0) {
      setActiveTab(roadmaps.length - 1);
    }
  }, [roadmaps.length, activeTab]);

  const totalRoadmaps = roadmaps.length;
  const completedRoadmaps = roadmaps.filter((r) =>
    r.stagesToDreamJob.length > 0 && r.stagesToDreamJob.every((s) => s.isDone)
  ).length;

  const activeRoadmap = roadmaps[activeTab] ?? null;

  return (
    <div className="roadmap-page">
      <main className="roadmap-container">
        <div className="roadmap-header">
          <div>
            <h1 className="roadmap-title">Career Roadmap</h1>
            <p className="roadmap-subtitle">Your personalized path to your dream role</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="btn-add-goal"
              onClick={() => setShowCreateModal(true)}
            >
              <img src={iconPlus} alt="" aria-hidden="true" className="btn-icon btn-icon--white" />
              Add Roadmap
            </button>
            <button
              type="button"
              className="btn-ai-guide"
              onClick={() => navigate('/chat')}
            >
              <img src={iconMessage} alt="" aria-hidden="true" className="btn-icon btn-icon--white" />
              AI Career Guide
            </button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon-wrap stat-icon-wrap--blue">
              <img src={iconChart} alt="" aria-hidden="true" className="stat-icon-img stat-icon-img--blue" />
            </div>
            <div className="stat-info">
              <span className="stat-label">Active Roadmaps</span>
              <span className="stat-value">{fetchState === 'success' ? totalRoadmaps - completedRoadmaps : '-'}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap stat-icon-wrap--green">
              <img src={iconTrophy} alt="" aria-hidden="true" className="stat-icon-img stat-icon-img--green" />
            </div>
            <div className="stat-info">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{fetchState === 'success' ? completedRoadmaps : '-'}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap stat-icon-wrap--purple">
              <img src={iconList} alt="" aria-hidden="true" className="stat-icon-img stat-icon-img--purple" />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Roadmaps</span>
              <span className="stat-value">{fetchState === 'success' ? totalRoadmaps : '-'}</span>
            </div>
          </div>
        </div>

        {fetchState === 'loading' && (
          <div className="page-loading"><div className="spinner" /><p>Loading your roadmap...</p></div>
        )}

        {fetchState === 'error' && (
          <div className="page-error">
            <p>Could not load roadmap: {errorMessage}</p>
            <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={loadData}>
              Try Again
            </button>
          </div>
        )}

        {fetchState === 'success' && roadmaps.length === 0 && (
          <div className="roadmap-empty surface-card">
            <img src={iconChart} alt="" className="roadmap-empty-icon" aria-hidden="true" />
            <h2>No roadmap yet</h2>
            <p>Create a personalized career roadmap to track your path to your dream role.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
                <img src={iconPlus} alt="" className="btn-icon btn-icon--white" aria-hidden="true" />
                Create Roadmap
              </button>
              <button type="button" className="btn-outline" onClick={() => navigate('/chat')}>
                <img src={iconMessage} alt="" className="btn-icon" aria-hidden="true" />
                AI Career Guide
              </button>
            </div>
          </div>
        )}

        {fetchState === 'success' && roadmaps.length > 0 && (
          <div className="roadmap-tab-area">

            {roadmaps.length > 1 && (
              <div className="roadmap-tab-bar" role="tablist" aria-label="Career roadmaps">
                {roadmaps.map((rm, idx) => (
                  <button
                    key={rm.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeTab}
                    className={`roadmap-tab${idx === activeTab ? ' roadmap-tab--active' : ''}`}
                    onClick={() => setActiveTab(idx)}
                  >
                    <span className="roadmap-tab-label">{rm.dreamJob}</span>
                    {rm.stagesToDreamJob.every((s) => s.isDone) && rm.stagesToDreamJob.length > 0 && (
                      <span className="roadmap-tab-done-dot" title="Completed" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {activeRoadmap && (() => {
              const doneCount = activeRoadmap.stagesToDreamJob.filter((s) => s.isDone).length;
              const totalStages = activeRoadmap.stagesToDreamJob.length;
              const pct = totalStages === 0 ? 0 : Math.round((doneCount / totalStages) * 100);

              return (
                <div className="main-roadmap-card" key={activeRoadmap.id}>
                  <div className="card-top-info">
                    <h3 className="roadmap-card-title">
                      Path to <span className="dream-job-name">{activeRoadmap.dreamJob}</span>
                    </h3>
                    <p className="meta-info">
                      {doneCount} of {totalStages} steps completed
                    </p>
                  </div>

                  <div className="progress-section">
                    <div className="progress-label">
                      <span>Overall Progress</span>
                      <span className="progress-pct">{pct}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="steps-list">
                    {activeRoadmap.stagesToDreamJob.map((stage, idx) => {
                      const content = STEP_CONTENT[idx] ?? { label: `Step ${idx + 1}`, description: '', actions: [] };
                      const isNext = !stage.isDone && (idx === 0 || activeRoadmap.stagesToDreamJob[idx - 1]?.isDone);
                      const isLocked = !stage.isDone && !isNext;

                      return (
                        <div
                          key={stage.jobId}
                          className={`step-row${isLocked ? ' step-row--locked' : ''}`}
                        >
                          <div className={`step-circle ${stage.isDone ? 'step-circle--done' : isNext ? 'step-circle--pending' : 'step-circle--locked'}`}>
                            {stage.isDone
                              ? <img src={iconCheck} alt="done" className="step-check-img" />
                              : <span>{idx + 1}</span>}
                          </div>
                          <div className="step-body">
                            <div className="step-meta">
                              <span className="step-time">Step {idx + 1}</span>
                              {stage.isDone && <span className="badge badge-green">Completed</span>}
                              {isNext && <span className="badge badge-yellow">In Progress</span>}
                              {isLocked && <span className="badge badge-blue">Upcoming</span>}
                            </div>
                            <h4 className="step-heading">{content.label}</h4>
                            <p className="step-desc">{content.description}</p>
                            {(stage.isDone || isNext) && content.actions.length > 0 && (
                              <ul className="step-actions">
                                {content.actions.map((action) => (
                                  <li key={action}>{action}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </main>

      {showCreateModal && user?.id && (
        <CreateRoadmapModal
          userId={user.id}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
            setActiveTab(roadmaps.length); // switch to the new tab
          }}
        />
      )}

      {!isChatOpen && user?.id && (
        <button
          type="button"
          className="roadmap-chat-fab"
          onClick={() => setIsChatOpen(true)}
          aria-label="Open AI career coach chat"
        >
          <img src={iconMessage} alt="" aria-hidden="true" className="roadmap-chat-fab-icon" />
        </button>
      )}
      {isChatOpen && (
        <div className="floating-chat-wrapper">
          <div className="chat-header-bar">
            <span>CareerCoach AI</span>
            <button type="button" className="close-chat" onClick={() => setIsChatOpen(false)} aria-label="Close chat">
              X
            </button>
          </div>
          {user?.id && floatingChatConversationId ? (
          <ChatInterface
            userId={user.id}
            conversationId={floatingChatConversationId}
            userProfile={{
              firstName: user?.firstName,
              lastName: user?.lastName,
              currentJob: user?.currentJob,
              achievements: user?.achievements,
              technologies: user?.technologies,
              interests: user?.interests,
              githubSkills: user?.githubSkills,
              knownSkills: user?.knownSkills,
              cvExcerpt:
                user?.cv && typeof user.cv === 'string' && user.cv.trim().length > 0
                  ? user.cv.trim().slice(0, 4000)
                  : undefined,
            }}
          />
          ) : (
            <div className="floating-chat-loading">Loading chat…</div>
          )}
        </div>
      )}
    </div>
  );
};
