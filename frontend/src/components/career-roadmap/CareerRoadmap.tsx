import { useState, useEffect, useCallback } from 'react';
import { CreateRoadmapModal } from './CreateRoadmapModal';
import { ChatInterface } from '../chat-component/Chat';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import iconChart from '../../assets/icon-chart.svg';
import iconTrophy from '../../assets/icon-trophy.svg';
import iconMessage from '../../assets/icon-message.svg';
import iconCheck from '../../assets/icon-check.svg';
import iconPlus from '../../assets/icon-plus.svg';
import { getPlatformStyle, getResourceTypeStyle } from './platform-config';
import './CareerRoadmap.css';
import type { CareerRoadmapData, CareerRoadmapProps, FetchState, StageContent } from './career-roadmap.types';

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

const GENERIC_STAGE_CONTENT: StageContent[] = [
  { label: 'Foundation & Fundamentals', description: 'Build the core skills and knowledge base required for your target role.', actions: ['Master core programming fundamentals', 'Complete foundational courses or certifications', 'Build small practice projects'] },
  { label: 'Intermediate Growth', description: 'Apply your knowledge on real projects and deepen your technical expertise.', actions: ['Contribute to real-world projects', 'Build a portfolio with meaningful use cases', 'Learn testing, CI/CD, and best practices'] },
  { label: 'Advanced Proficiency', description: 'Develop deep expertise in your domain and tackle complex engineering challenges.', actions: ['Solve complex architectural problems', 'Lead technical discussions and design reviews', 'Study advanced patterns and system design'] },
  { label: 'Leadership & Expertise', description: 'Lead technical initiatives and drive impactful decisions that shape projects and teams.', actions: ['Lead cross-functional technical projects', 'Drive architecture and tooling decisions', 'Build and grow high-performing team members'] },
  { label: 'Final Stretch', description: 'The last steps before reaching your dream role. Polish your skills and position yourself.', actions: ['Prepare thoroughly for senior-level interviews', 'Build and nurture your professional network', 'Refine your portfolio and personal brand'] },
];

export const CareerRoadmap = ({ user }: CareerRoadmapProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [roadmaps, setRoadmaps] = useState<CareerRoadmapData[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [floatingChatConversationId, setFloatingChatConversationId] = useState<string | null>(null);
  const [togglingStageJobId, setTogglingStageJobId] = useState<number | null>(null);
  const [expandedDoneStages, setExpandedDoneStages] = useState<ReadonlySet<number>>(new Set());

  const toggleExpandedStage = (jobId: number) => {
    setExpandedDoneStages((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const toggleStage = async (roadmap: CareerRoadmapData, stageIndex: number, currentDone: boolean) => {
    const isNext = !currentDone && (stageIndex === 0 || roadmap.stagesToDreamJob[stageIndex - 1]?.isDone);
    if (!currentDone && !isNext) {
      return;
    }

    const updatedStages = roadmap.stagesToDreamJob.map((stage, idx) => {
      if (currentDone && idx >= stageIndex) {
        return { ...stage, isDone: false };
      }
      if (!currentDone && idx === stageIndex) {
        return { ...stage, isDone: true };
      }
      return stage;
    });

    const stage = roadmap.stagesToDreamJob[stageIndex];
    if (!stage) {
      return;
    }

    setTogglingStageJobId(stage.jobId);
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${roadmap.id}/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stagesToDreamJob: updatedStages }),
      });
      if (!res.ok) {
        throw new Error('Failed to update stage');
      }
      const updated: unknown = await res.json();
      if (
        typeof updated === 'object' &&
        updated !== null &&
        'id' in updated &&
        'stagesToDreamJob' in updated &&
        Array.isArray((updated as CareerRoadmapData).stagesToDreamJob)
      ) {
        setRoadmaps((prev) =>
          prev.map((item) => (item.id === roadmap.id ? (updated as CareerRoadmapData) : item))
        );
        return;
      }
      setRoadmaps((prev) =>
        prev.map((item) =>
          item.id === roadmap.id ? { ...item, stagesToDreamJob: updatedStages } : item
        )
      );
    } catch {
      setErrorMessage('Could not update step progress. Please try again.');
    } finally {
      setTogglingStageJobId(null);
    }
  };

  const toggleAction = async (roadmap: CareerRoadmapData, stageIndex: number, action: string) => {
    const stage = roadmap.stagesToDreamJob[stageIndex];
    if (!stage) {
      return;
    }

    const actions = (stage.content ?? GENERIC_STAGE_CONTENT[stageIndex])?.actions ?? [];
    if (actions.length === 0) {
      return;
    }

    const current = stage.isDone ? [...actions] : (stage.completedActions ?? []);
    const nextCompleted = current.includes(action)
      ? current.filter((item) => item !== action)
      : [...current, action];

    const allActionsDone = actions.every((item) => nextCompleted.includes(item));

    const updatedStages = roadmap.stagesToDreamJob.map((item, idx) =>
      idx === stageIndex ? { ...item, completedActions: nextCompleted, isDone: allActionsDone } : item
    );

    setRoadmaps((prev) =>
      prev.map((item) => (item.id === roadmap.id ? { ...item, stagesToDreamJob: updatedStages } : item))
    );

    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${roadmap.id}/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stagesToDreamJob: updatedStages }),
      });
      if (!res.ok) {
        throw new Error('Failed to update sub-task');
      }
    } catch {
      setRoadmaps((prev) => prev.map((item) => (item.id === roadmap.id ? roadmap : item)));
      setErrorMessage('Could not update sub-task. Please try again.');
    }
  };

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

  // Keep active tab in bounds when roadmaps change; -1 sentinel means "select last"
  useEffect(() => {
    if (roadmaps.length === 0) return;
    if (activeTab < 0 || activeTab >= roadmaps.length) {
      setActiveTab(roadmaps.length - 1);
    }
  }, [roadmaps.length, activeTab]);

  const activeRoadmap = roadmaps[activeTab] ?? null;

  return (
    <div className="roadmap-page">
      <main className="roadmap-container">
        <div className="roadmap-header">
          <div>
            <h1 className="roadmap-title">Career Roadmap</h1>
            <p className="roadmap-subtitle">Your personalized path to your dream role</p>
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
              const allDone = totalStages > 0 && doneCount === totalStages;

              const stageFraction = (stage: typeof activeRoadmap.stagesToDreamJob[number], idx: number): number => {
                if (stage.isDone) return 1;
                const actions = (stage.content ?? GENERIC_STAGE_CONTENT[idx])?.actions ?? [];
                if (actions.length === 0) return 0;
                const doneActions = (stage.completedActions ?? []).filter((a) => actions.includes(a)).length;
                return doneActions / actions.length;
              };
              const progressSum = activeRoadmap.stagesToDreamJob.reduce((sum, stage, idx) => sum + stageFraction(stage, idx), 0);
              const pct = totalStages === 0 ? 0 : Math.round((progressSum / totalStages) * 100);

              return (
                <div className="roadmap-journey" key={activeRoadmap.id}>
                  <div className={`journey-goal${allDone ? ' journey-goal--reached' : ''}`}>
                    <div className="journey-goal-text">
                      <span className="journey-goal-eyebrow">Your destination</span>
                      <h3 className="journey-goal-title">{activeRoadmap.dreamJob}</h3>
                      <p className="journey-goal-meta">{doneCount} of {totalStages} milestones completed</p>
                    </div>
                    <div
                      className={`journey-ring${allDone ? ' journey-ring--complete' : ''}`}
                      style={{ '--ring-pct': pct } as React.CSSProperties}
                      role="img"
                      aria-label={`${pct}% complete`}
                    >
                      <div className="journey-ring-inner">
                        {allDone ? (
                          <img src={iconTrophy} alt="" className="journey-ring-trophy" aria-hidden="true" />
                        ) : (
                          <span className="journey-ring-pct">{pct}<span className="journey-ring-sign">%</span></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="journey-timeline">
                    {activeRoadmap.stagesToDreamJob.map((stage, idx) => {
                      const content: StageContent = stage.content ?? GENERIC_STAGE_CONTENT[idx] ?? { label: `Step ${idx + 1}`, description: '', actions: [] };
                      const isNext = !stage.isDone && (idx === 0 || activeRoadmap.stagesToDreamJob[idx - 1]?.isDone);
                      const isLocked = !stage.isDone && !isNext;
                      const state = stage.isDone ? 'done' : isNext ? 'active' : 'locked';
                      const prevDone = idx === 0 || activeRoadmap.stagesToDreamJob[idx - 1]?.isDone === true;
                      const isExpanded = expandedDoneStages.has(stage.jobId);
                      const showDetails = !stage.isDone || isExpanded;

                      return (
                        <div
                          key={stage.jobId}
                          className={`journey-row journey-row--${state}${prevDone ? ' journey-row--line-top' : ''}${stage.isDone ? ' journey-row--line-bottom' : ''}`}
                        >
                          <div className="journey-rail">
                            <button
                              type="button"
                              className="journey-dot"
                              onClick={() => toggleStage(activeRoadmap, idx, stage.isDone)}
                              disabled={isLocked || togglingStageJobId === stage.jobId}
                              aria-label={
                                stage.isDone
                                  ? `Mark step ${idx + 1} as incomplete`
                                  : `Mark step ${idx + 1} as complete`
                              }
                            >
                              {stage.isDone ? (
                                <img src={iconCheck} alt="" className="step-check-img" aria-hidden="true" />
                              ) : (
                                <span className="journey-dot-number">{idx + 1}</span>
                              )}
                            </button>
                          </div>
                          <div className={`journey-card${stage.isDone && !isExpanded ? ' journey-card--collapsed' : ''}`}>
                            <div className="journey-card-head">
                              <div className="journey-card-titles">
                                <span className="journey-step-num">Step {idx + 1}</span>
                                <h4 className="journey-card-title">{content.label}</h4>
                              </div>
                              <div className="journey-card-badges">
                                {stage.isDone && <span className="badge badge-green">Completed</span>}
                                {isLocked && <span className="badge badge-blue">Upcoming</span>}
                                {content.estimatedTimeframe && (
                                  <span className="journey-timeframe">{content.estimatedTimeframe}</span>
                                )}
                                {isNext && (
                                  <button
                                    type="button"
                                    className="journey-complete-icon"
                                    onClick={() => toggleStage(activeRoadmap, idx, stage.isDone)}
                                    disabled={togglingStageJobId === stage.jobId}
                                    aria-label={`Mark step ${idx + 1} as complete`}
                                    title="Mark step complete"
                                  >
                                    <img src={iconCheck} alt="" aria-hidden="true" />
                                  </button>
                                )}
                                {stage.isDone && (
                                  <button
                                    type="button"
                                    className="journey-collapse-btn"
                                    onClick={() => toggleExpandedStage(stage.jobId)}
                                    aria-expanded={isExpanded}
                                    aria-label={isExpanded ? `Collapse step ${idx + 1}` : `Expand step ${idx + 1}`}
                                  >
                                    <span className={`journey-caret${isExpanded ? ' journey-caret--open' : ''}`} aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {showDetails && <p className="journey-card-desc">{content.description}</p>}
                            {showDetails && content.actions.length > 0 && (
                              <ul className="journey-subtasks">
                                {content.actions.map((action) => {
                                  const actionDone = stage.isDone || (stage.completedActions ?? []).includes(action);
                                  return (
                                    <li
                                      key={action}
                                      className={`journey-subtask${actionDone ? ' journey-subtask--done' : ''}`}
                                    >
                                      <button
                                        type="button"
                                        className={`journey-subtask-check${actionDone ? ' journey-subtask-check--done' : ''}`}
                                        onClick={() => toggleAction(activeRoadmap, idx, action)}
                                        disabled={togglingStageJobId === stage.jobId}
                                        aria-label={
                                          actionDone
                                            ? `Mark "${action}" as not done`
                                            : `Mark "${action}" as done`
                                        }
                                      >
                                        {actionDone && <img src={iconCheck} alt="" aria-hidden="true" />}
                                      </button>
                                      <span className="journey-subtask-label">{action}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {showDetails && content.resources && content.resources.length > 0 && (
                              <div className="step-resources">
                                <span className="step-resources-label">Learning Resources</span>
                                <div className="step-resource-cards">
                                  {content.resources.map((resource) => {
                                    const ps = getPlatformStyle(resource.platform);
                                    const ts = getResourceTypeStyle(resource.type);
                                    return (
                                      <a
                                        key={resource.url}
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="resource-card"
                                        style={{
                                          '--platform-accent': ps.accentColor,
                                          '--platform-bg': ps.bgTint,
                                        } as React.CSSProperties}
                                      >
                                        <div className="resource-card-header">
                                          <span className="resource-card-icon">{ps.icon}</span>
                                          <span className="resource-platform">{ps.label}</span>
                                        </div>
                                        <span className="resource-title">{resource.title}</span>
                                        {ts && (
                                          <span
                                            className="resource-type-badge"
                                            style={{ color: ts.color, background: ts.bg }}
                                          >
                                            {ts.label}
                                          </span>
                                        )}
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div className={`journey-row journey-row--goal${allDone ? ' journey-row--line-top journey-row--goal-reached' : ''}`}>
                      <div className="journey-rail">
                        <div className="journey-dot journey-dot--goal">
                          <img src={iconTrophy} alt="" className="journey-goal-trophy" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="journey-card journey-card--goal">
                        <span className="journey-step-num">Destination</span>
                        <h4 className="journey-card-title">{activeRoadmap.dreamJob}</h4>
                        <p className="journey-card-desc">
                          {allDone
                            ? 'Congratulations — you reached your dream role!'
                            : 'Your dream role awaits at the end of this path. Keep going!'}
                        </p>
                      </div>
                    </div>
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
            setActiveTab(-1); // sentinel: pick last tab after load
            loadData();
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
