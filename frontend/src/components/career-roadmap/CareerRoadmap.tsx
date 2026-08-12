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
import iconX from '../../assets/icon-x.svg';
import { getPlatformStyle, getResourceTypeStyle } from './platform-config';
import { StageOpportunitiesPanel } from './StageOpportunitiesPanel';
import { DestinationJobSearch } from './DestinationJobSearch';
import { StageEvidenceEditor } from './StageEvidenceEditor';
import { StageActionPlanPanel } from './StageActionPlanPanel';
import './CareerRoadmap.css';
import type { CareerProgressionMeta, CareerRoadmapData, CareerRoadmapProps, FetchState, ProgressEvidence, RoadmapGenerationResponse, StageContent } from './career-roadmap.types';

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

const arePrerequisitesComplete = (roadmap: CareerRoadmapData, stageIndex: number): boolean => {
  const stage = roadmap.stagesToDreamJob[stageIndex];
  const prerequisites = stage?.content?.prerequisiteStageIds ?? [];
  if (prerequisites.length === 0) {
    return stageIndex === 0 || roadmap.stagesToDreamJob[stageIndex - 1]?.isDone === true;
  }
  return prerequisites.every((stageId) =>
    roadmap.stagesToDreamJob.some((candidate) => candidate.content?.stageId === stageId && candidate.isDone)
  );
};

type UpgradePreview = {
  roadmapId: string;
  stages: StageContent[];
  progressionMeta?: CareerProgressionMeta;
};

type StageUpgradePreview = {
  roadmapId: string;
  stageIndex: number;
  content: StageContent;
};

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
  const [gapExpanded, setGapExpanded] = useState(false);
  const [deletingRoadmapId, setDeletingRoadmapId] = useState<string | null>(null);
  const [upgradingRoadmapId, setUpgradingRoadmapId] = useState<string | null>(null);
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
  const [stageUpgradePreview, setStageUpgradePreview] = useState<StageUpgradePreview | null>(null);
  const [improvingStageJobId, setImprovingStageJobId] = useState<number | null>(null);

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

  const deleteRoadmap = async (roadmap: CareerRoadmapData) => {
    const confirmed = window.confirm(
      `Delete your roadmap for "${roadmap.dreamJob}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingRoadmapId(roadmap.id);
    setErrorMessage('');
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${roadmap.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete roadmap');
      setRoadmaps((prev) => prev.filter((item) => item.id !== roadmap.id));
      setActiveTab(0);
      setExpandedDoneStages(new Set());
      setGapExpanded(false);
    } catch {
      setErrorMessage('Could not delete roadmap. Please try again.');
    } finally {
      setDeletingRoadmapId(null);
    }
  };

  const toggleStage = async (roadmap: CareerRoadmapData, stageIndex: number, currentDone: boolean) => {
    const isNext = !currentDone && arePrerequisitesComplete(roadmap, stageIndex);
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

  const toggleResource = async (roadmap: CareerRoadmapData, stageIndex: number, resourceUrl: string) => {
    const stage = roadmap.stagesToDreamJob[stageIndex];
    if (!stage) return;
    const completedResourceUrls = stage.completedResourceUrls ?? [];
    const nextCompleted = completedResourceUrls.includes(resourceUrl)
      ? completedResourceUrls.filter((url) => url !== resourceUrl)
      : [...completedResourceUrls, resourceUrl];
    const updatedStages = roadmap.stagesToDreamJob.map((item, index) =>
      index === stageIndex ? { ...item, completedResourceUrls: nextCompleted } : item
    );
    setRoadmaps((items) => items.map((item) => item.id === roadmap.id ? { ...item, stagesToDreamJob: updatedStages } : item));
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${roadmap.id}/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stagesToDreamJob: updatedStages }),
      });
      if (!res.ok) throw new Error('Failed to update course progress');
    } catch {
      setRoadmaps((items) => items.map((item) => item.id === roadmap.id ? roadmap : item));
      setErrorMessage('Could not update course progress. Please try again.');
    }
  };

  const addStageEvidence = async (roadmap: CareerRoadmapData, stageIndex: number, evidence: ProgressEvidence): Promise<boolean> => {
    const updatedStages = roadmap.stagesToDreamJob.map((stage, index) =>
      index === stageIndex ? { ...stage, progressEvidence: [...(stage.progressEvidence ?? []), evidence] } : stage
    );
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${roadmap.id}/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stagesToDreamJob: updatedStages }),
      });
      if (!res.ok) throw new Error('Failed to save progress evidence');
      setRoadmaps((items) => items.map((item) => item.id === roadmap.id ? { ...item, stagesToDreamJob: updatedStages } : item));
      return true;
    } catch {
      setErrorMessage('Could not save progress evidence. Please try again.');
      return false;
    }
  };

  const updateStageChoices = async (roadmap: CareerRoadmapData, stageIndex: number, changes: Partial<typeof roadmap.stagesToDreamJob[number]>): Promise<boolean> => {
    const updatedStages = roadmap.stagesToDreamJob.map((stage, index) => index === stageIndex ? { ...stage, ...changes } : stage);
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${roadmap.id}/stages`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ stagesToDreamJob: updatedStages }),
      });
      if (!res.ok) throw new Error('Failed to save stage choices');
      setRoadmaps((items) => items.map((item) => item.id === roadmap.id ? { ...item, stagesToDreamJob: updatedStages } : item));
      return true;
    } catch {
      setErrorMessage('Could not update this stage. Please try again.');
      return false;
    }
  };

  const previewRoadmapUpgrade = async (roadmap: CareerRoadmapData) => {
    setUpgradingRoadmapId(roadmap.id);
    setErrorMessage('');
    try {
      const res = await apiFetch(`${ENV.ROADMAP_SERVICE_BASE_URL}/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: roadmap.userId,
          dreamJob: roadmap.dreamJob,
          targetYears: roadmap.progressionMeta?.targetYears ?? 3,
        }),
      });
      if (!res.ok) throw new Error('Roadmap reassessment failed');
      const data: unknown = await res.json();
      if (typeof data !== 'object' || data === null || !('stages' in data) || !Array.isArray(data.stages)) {
        throw new Error('Invalid roadmap reassessment');
      }
      const generated = data as RoadmapGenerationResponse;
      setUpgradePreview({
        roadmapId: roadmap.id,
        stages: generated.stages,
        ...(generated.progressionMeta ? { progressionMeta: generated.progressionMeta } : {}),
      });
    } catch {
      setErrorMessage('Could not prepare the roadmap update. Please try again.');
    } finally {
      setUpgradingRoadmapId(null);
    }
  };

  const applyRoadmapUpgrade = async () => {
    if (!upgradePreview) return;
    const roadmap = roadmaps.find((item) => item.id === upgradePreview.roadmapId);
    if (!roadmap) return;
    const completedStages = roadmap.stagesToDreamJob
      .filter((stage) => stage.isDone)
      .map((stage) => {
        if (stage.content?.stageId || !stage.content?.templateId) return stage;
        const matchingGeneratedStage = upgradePreview.stages.find((content) => content.templateId === stage.content?.templateId);
        return matchingGeneratedStage?.stageId
          ? { ...stage, content: { ...stage.content, stageId: matchingGeneratedStage.stageId } }
          : stage;
      });
    const completedTemplateIds = new Set(completedStages.map((stage) => stage.content?.templateId).filter(Boolean));
    const maxJobId = roadmap.stagesToDreamJob.reduce((maximum, stage) => Math.max(maximum, stage.jobId), 0);
    const futureStages = upgradePreview.stages
      .filter((content) => !content.templateId || !completedTemplateIds.has(content.templateId))
      .map((content, index) => ({ jobId: maxJobId + index + 1, isDone: false, content }));
    const stagesToDreamJob = [...completedStages, ...futureStages];
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${roadmap.id}/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stagesToDreamJob, progressionMeta: upgradePreview.progressionMeta }),
      });
      if (!res.ok) throw new Error('Failed to update roadmap');
      setUpgradePreview(null);
      loadData();
    } catch {
      setErrorMessage('Could not apply the roadmap update. Please try again.');
    }
  };

  const previewStageUpgrade = async (roadmap: CareerRoadmapData, stageIndex: number) => {
    const stage = roadmap.stagesToDreamJob[stageIndex];
    if (!stage) return;
    setImprovingStageJobId(stage.jobId);
    setErrorMessage('');
    try {
      const res = await apiFetch(`${ENV.ROADMAP_SERVICE_BASE_URL}/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: roadmap.userId,
          dreamJob: roadmap.dreamJob,
          targetYears: roadmap.progressionMeta?.targetYears ?? 3,
        }),
      });
      if (!res.ok) throw new Error('Stage reassessment failed');
      const data: unknown = await res.json();
      if (typeof data !== 'object' || data === null || !('stages' in data) || !Array.isArray(data.stages)) {
        throw new Error('Invalid stage reassessment');
      }
      const generated = data as RoadmapGenerationResponse;
      const matchedContent = generated.stages.find((content) =>
        Boolean(stage.content?.templateId) && content.templateId === stage.content?.templateId
      ) ?? generated.stages[stageIndex];
      if (!matchedContent) throw new Error('No matching improved stage');
      setStageUpgradePreview({ roadmapId: roadmap.id, stageIndex, content: matchedContent });
    } catch {
      setErrorMessage('Could not prepare this stage improvement. Please try again.');
    } finally {
      setImprovingStageJobId(null);
    }
  };

  const applyStageUpgrade = async () => {
    if (!stageUpgradePreview) return;
    const roadmap = roadmaps.find((item) => item.id === stageUpgradePreview.roadmapId);
    if (!roadmap) return;
    const stagesToDreamJob = roadmap.stagesToDreamJob.map((stage, index) => index === stageUpgradePreview.stageIndex
      ? { ...stage, content: stageUpgradePreview.content }
      : stage);
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/${roadmap.id}/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stagesToDreamJob }),
      });
      if (!res.ok) throw new Error('Failed to improve stage');
      setRoadmaps((items) => items.map((item) => item.id === roadmap.id ? { ...item, stagesToDreamJob } : item));
      setStageUpgradePreview(null);
    } catch {
      setErrorMessage('Could not apply this stage improvement. Please try again.');
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

    const criteria = stage.content?.completionCriteria ?? [];
    const allActionsDone =
      criteria.length > 0
        ? criteria.every((criterion) => (stage.completedCriterionIds ?? []).includes(criterion.id)) &&
          actions.every((item) => nextCompleted.includes(item))
        : actions.every((item) => nextCompleted.includes(item));

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
          {fetchState === 'success' && activeRoadmap && (
            <button
              type="button"
              className="btn-outline roadmap-delete-btn"
              onClick={() => deleteRoadmap(activeRoadmap)}
              disabled={deletingRoadmapId === activeRoadmap.id}
              aria-label={`Delete roadmap for ${activeRoadmap.dreamJob}`}
            >
              <img src={iconX} alt="" aria-hidden="true" className="roadmap-delete-icon" />
              {deletingRoadmapId === activeRoadmap.id ? 'Deleting...' : 'Delete Roadmap'}
            </button>
          )}
        </div>

        {fetchState === 'loading' && (
          <div className="roadmap-skeleton">
            <div className="skeleton-card">
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line skeleton-line--subtitle" />
              <div className="skeleton-progress">
                <div className="skeleton-line skeleton-line--label" />
                <div className="skeleton-line skeleton-line--bar" />
              </div>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-step">
                  <div className="skeleton-circle" />
                  <div className="skeleton-step-body">
                    <div className="skeleton-line skeleton-line--step-label" />
                    <div className="skeleton-line skeleton-line--step-heading" />
                    <div className="skeleton-line skeleton-line--step-desc" />
                    <div className="skeleton-line skeleton-line--step-desc-short" />
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                const criteria = stage.content?.completionCriteria ?? [];
                if (criteria.length > 0) {
                  const completed = new Set(stage.completedCriterionIds ?? []);
                  return criteria.filter((criterion) => completed.has(criterion.id)).length / criteria.length;
                }
                const actions = (stage.content ?? GENERIC_STAGE_CONTENT[idx])?.actions ?? [];
                if (actions.length === 0) return 0;
                const doneActions = (stage.completedActions ?? []).filter((a) => actions.includes(a)).length;
                return doneActions / actions.length;
              };
              const progressSum = activeRoadmap.stagesToDreamJob.reduce((sum, stage, idx) => sum + stageFraction(stage, idx), 0);
              const pct = totalStages === 0 ? 0 : Math.round((progressSum / totalStages) * 100);

              return (
                <div className="roadmap-journey" key={activeRoadmap.id}>
                  {activeRoadmap.progressionMeta && (
                    <div className="journey-context-bar">
                      <div className={`journey-gap-summary${gapExpanded ? ' journey-gap-summary--expanded' : ''}`}>
                        <button
                          type="button"
                          className="journey-gap-toggle"
                          onClick={() => setGapExpanded((prev) => !prev)}
                          aria-expanded={gapExpanded}
                          aria-controls={`gap-analysis-${activeRoadmap.id}`}
                        >
                          <span>
                            <strong>Roadmap analysis</strong>
                            <small>{gapExpanded ? 'Hide profile, timeline, and gaps' : 'View profile, timeline, and gaps'}</small>
                          </span>
                          <span className="journey-gap-chevron" aria-hidden="true" />
                        </button>
                        {gapExpanded && (
                          <div id={`gap-analysis-${activeRoadmap.id}`} className="journey-gap-content">
                            {activeRoadmap.progressionMeta.currentRoleSummary && (
                              <p className="journey-context-today">
                                <strong>Where you are:</strong> {activeRoadmap.progressionMeta.currentRoleSummary}
                              </p>
                            )}
                            {activeRoadmap.progressionMeta.gapAnalysis?.skillsPresent &&
                              activeRoadmap.progressionMeta.gapAnalysis.skillsPresent.length > 0 && (
                                <p className="journey-context-skills">
                                  <strong>Skills we know:</strong>{' '}
                                  {activeRoadmap.progressionMeta.gapAnalysis.skillsPresent.join(', ')}
                                </p>
                              )}
                            <p className="journey-context-target">
                              <strong>Target role:</strong>{' '}
                              {activeRoadmap.progressionMeta.dreamRoleCategory ?? activeRoadmap.dreamJob}
                              {activeRoadmap.progressionMeta.estimatedYearsToGoal && (
                                <span> · {activeRoadmap.progressionMeta.estimatedYearsToGoal}</span>
                              )}
                            </p>
                            {activeRoadmap.progressionMeta.progressionReasoning && (
                              <p className="journey-context-reasoning">{activeRoadmap.progressionMeta.progressionReasoning}</p>
                            )}
                            {activeRoadmap.progressionMeta.feasibility && (
                              <div className={`roadmap-feasibility roadmap-feasibility--${activeRoadmap.progressionMeta.feasibility.status}`}>
                                <strong>{activeRoadmap.progressionMeta.feasibility.status === 'on-track' ? 'Timeline assessment' : 'Important timeline assessment'}</strong>
                                <span>{activeRoadmap.progressionMeta.feasibility.message}</span>
                                {activeRoadmap.progressionMeta.feasibility.reasons.map((reason) => <small key={reason}>{reason}</small>)}
                              </div>
                            )}
                            {activeRoadmap.progressionMeta.gapAnalysis && (
                              <div className="journey-gap-details">
                                <strong className="journey-gap-heading">Gaps to close</strong>
                                <ul className="journey-gap-list">
                                  {activeRoadmap.progressionMeta.gapAnalysis.skillsMissing.length > 0 && (
                                    <li><strong>Skills to build:</strong> {activeRoadmap.progressionMeta.gapAnalysis.skillsMissing.join(', ')}</li>
                                  )}
                                  {activeRoadmap.progressionMeta.gapAnalysis.responsibilitiesMissing.length > 0 && (
                                    <li><strong>Responsibilities:</strong> {activeRoadmap.progressionMeta.gapAnalysis.responsibilitiesMissing.slice(0, 4).join('; ')}</li>
                                  )}
                                  {activeRoadmap.progressionMeta.gapAnalysis.leadershipGaps.length > 0 && (
                                    <li><strong>Leadership:</strong> {activeRoadmap.progressionMeta.gapAnalysis.leadershipGaps.slice(0, 3).join('; ')}</li>
                                  )}
                                  {activeRoadmap.progressionMeta.gapAnalysis.architectureGaps.length > 0 && (
                                    <li><strong>Architecture:</strong> {activeRoadmap.progressionMeta.gapAnalysis.architectureGaps.slice(0, 3).join('; ')}</li>
                                  )}
                                  <li>{activeRoadmap.progressionMeta.gapAnalysis.experienceGapSummary}</li>
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

                  <div className="roadmap-upgrade-row">
                    <button
                      type="button"
                      onClick={() => void previewRoadmapUpgrade(activeRoadmap)}
                      disabled={upgradingRoadmapId === activeRoadmap.id}
                    >
                      {upgradingRoadmapId === activeRoadmap.id
                        ? 'Preparing update…'
                        : activeRoadmap.progressionMeta?.generationVersion
                          ? 'Reassess future stages'
                          : 'Upgrade roadmap'}
                    </button>
                    <span>Completed stages stay unchanged. Preview future changes before applying them.</span>
                  </div>

                  {user?.id && (
                    <DestinationJobSearch userId={user.id} defaultJobTitle={activeRoadmap.dreamJob} />
                  )}

                  {(activeRoadmap.progressionMeta?.alternativePaths?.length ?? 0) > 0 && (
                    <section className="roadmap-path-options" aria-label="Career path options">
                      <div className="roadmap-path-options-head">
                        <span>Career paths</span>
                        <p>Compare the recommended route with alternative ways to reach the same exact destination.</p>
                      </div>
                      <div className="roadmap-path-options-grid">
                        {activeRoadmap.progressionMeta!.alternativePaths!.map((path) => (
                          <article key={path.id} className={`roadmap-path-option${path.isRecommended ? ' roadmap-path-option--recommended' : ''}`}>
                            <h4>{path.label}{path.isRecommended && <span>Recommended</span>}</h4>
                            <p>{path.summary}</p>
                            <ol>{path.roles.map((role) => <li key={role}>{role}</li>)}</ol>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="journey-timeline">
                    {activeRoadmap.stagesToDreamJob.map((stage, idx) => {
                      const content: StageContent = stage.content ?? GENERIC_STAGE_CONTENT[idx] ?? { label: `Step ${idx + 1}`, description: '', actions: [] };
                      const isNext = !stage.isDone && arePrerequisitesComplete(activeRoadmap, idx);
                      const isLocked = !stage.isDone && !isNext;
                      const state = stage.isDone ? 'done' : isNext ? 'active' : 'locked';
                      const prevDone = arePrerequisitesComplete(activeRoadmap, idx);
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
                                {content.progressionType && (
                                  <span className="badge badge-purple">{content.progressionType}</span>
                                )}
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
                            {showDetails && content.whyItMatters && (
                              <p className="journey-card-why"><strong>Why it matters:</strong> {content.whyItMatters}</p>
                            )}
                            {showDetails && content.orderingReason && (
                              <div className={`journey-ordering${isLocked ? ' journey-ordering--required' : ''}`}>
                                <strong>{isLocked ? 'Required before this stage:' : 'Order and overlap:'}</strong> {content.orderingReason}
                                {(content.parallelStageIds?.length ?? 0) > 0 && (
                                  <span>This stage can run alongside another indicated roadmap stage.</span>
                                )}
                              </div>
                            )}
                            {showDetails && content.howToGetThere && (
                              <div className="journey-detail-block">
                                <span className="journey-detail-label">How to get there</span>
                                <p className="journey-card-desc">{content.howToGetThere}</p>
                              </div>
                            )}
                            {showDetails && content.whatYouGain && (
                              <div className="journey-detail-block">
                                <span className="journey-detail-label">What you gain</span>
                                <p className="journey-card-desc">{content.whatYouGain}</p>
                              </div>
                            )}
                            {showDetails && !content.howToGetThere && <p className="journey-card-desc">{content.description}</p>}
                            {showDetails && (content.requiredCapabilities?.length ?? 0) > 0 && (
                              <div className="journey-detail-block">
                                <span className="journey-detail-label">Required capabilities</span>
                                <ul className="journey-detail-list">
                                  {content.requiredCapabilities!.map((item) => <li key={item}>{item}</li>)}
                                </ul>
                              </div>
                            )}
                            {showDetails && (content.skillsToBuild?.length ?? 0) > 0 && (
                              <div className="journey-detail-block">
                                <span className="journey-detail-label">Skills to build</span>
                                <ul className="journey-detail-list">
                                  {content.skillsToBuild!.map((item) => <li key={item}>{item}</li>)}
                                </ul>
                              </div>
                            )}
                            {showDetails && (content.responsibilitiesToGain?.length ?? 0) > 0 && (
                              <div className="journey-detail-block">
                                <span className="journey-detail-label">Responsibilities to gain</span>
                                <ul className="journey-detail-list">
                                  {content.responsibilitiesToGain!.map((item) => <li key={item}>{item}</li>)}
                                </ul>
                              </div>
                            )}
                            {showDetails && content.experienceAccumulation && (
                              <p className="journey-experience-target">
                                <strong>Experience target:</strong> {content.experienceAccumulation}
                              </p>
                            )}
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
                            {showDetails && (
                              <div className="stage-improve-row">
                                <button type="button" onClick={() => void previewStageUpgrade(activeRoadmap, idx)} disabled={improvingStageJobId === stage.jobId}>
                                  {improvingStageJobId === stage.jobId ? 'Preparing preview…' : 'Improve this stage'}
                                </button>
                                <span>Preview updated roles, missions, projects, and courses before applying.</span>
                              </div>
                            )}
                            {showDetails && content.actionPlan && user?.id && (
                              <StageActionPlanPanel
                                stage={stage}
                                userId={user.id}
                                userSkills={user.technologies}
                                onUpdate={(changes) => updateStageChoices(activeRoadmap, idx, changes)}
                              />
                            )}
                            {showDetails && (
                              <StageEvidenceEditor
                                evidence={stage.progressEvidence ?? []}
                                onAdd={(evidence) => addStageEvidence(activeRoadmap, idx, evidence)}
                              />
                            )}
                            {showDetails && !content.actionPlan && (content.futureOpportunities?.length ?? 0) > 0 && (
                              <div className="journey-detail-block">
                                <span className="journey-detail-label">Future role categories</span>
                                <div className="journey-role-chips">
                                  {content.futureOpportunities!.map((role) => (
                                    <span key={role} className="journey-role-chip">{role}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {showDetails && !content.actionPlan &&
                              user?.id &&
                              (content.progressionType === 'experience' || content.progressionType === 'hybrid') && (
                              <StageOpportunitiesPanel
                                roleCategories={content.roleCategories ?? content.futureOpportunities ?? []}
                                userId={user.id}
                                userSkills={user?.technologies}
                              />
                            )}
                            {showDetails && content.resources && content.resources.length > 0 && (
                              <div className="step-resources">
                                <span className="step-resources-label">Learning Resources</span>
                                <div className="step-resource-cards">
                                  {content.resources.map((resource) => {
                                    const ps = getPlatformStyle(resource.platform);
                                    const ts = getResourceTypeStyle(resource.type);
                                    const completed = (stage.completedResourceUrls ?? []).includes(resource.url);
                                    return (
                                      <div
                                        key={resource.url}
                                        className={`resource-card${completed ? ' resource-card--completed' : ''}`}
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
                                        <div className="resource-meta">
                                          {resource.costType && <span>{resource.costType === 'free-audit' ? 'Free to audit' : resource.costType}</span>}
                                          {resource.difficulty && <span>{resource.difficulty}</span>}
                                          {resource.estimatedHours && <span>~{resource.estimatedHours}h</span>}
                                          {resource.priceLabel && <span>{resource.priceLabel}</span>}
                                        </div>
                                        {(resource.skills?.length ?? 0) > 0 && (
                                          <small className="resource-skills">Builds: {resource.skills!.join(', ')}</small>
                                        )}
                                        {resource.reason && <small className="resource-reason"><strong>Why this course:</strong> {resource.reason}</small>}
                                        {resource.lastVerifiedAt && <small className="resource-verified">Link verified {resource.lastVerifiedAt}</small>}
                                        {ts && (
                                          <span
                                            className="resource-type-badge"
                                            style={{ color: ts.color, background: ts.bg }}
                                          >
                                            {ts.label}
                                          </span>
                                        )}
                                        <div className="resource-actions">
                                          <a href={resource.url} target="_blank" rel="noopener noreferrer">Open course</a>
                                          <button type="button" onClick={() => void toggleResource(activeRoadmap, idx, resource.url)}>
                                            {completed ? '✓ Completed' : 'Mark completed'}
                                          </button>
                                        </div>
                                      </div>
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

      {upgradePreview && (() => {
        const roadmap = roadmaps.find((item) => item.id === upgradePreview.roadmapId);
        const completedCount = roadmap?.stagesToDreamJob.filter((stage) => stage.isDone).length ?? 0;
        return (
          <div className="roadmap-upgrade-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setUpgradePreview(null); }}>
            <div className="roadmap-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="roadmap-upgrade-title">
              <h3 id="roadmap-upgrade-title">Preview roadmap update</h3>
              <p>{completedCount} completed stage{completedCount === 1 ? '' : 's'} will be preserved. Future work will use the updated path below.</p>
              <ol>
                {upgradePreview.stages.map((stage) => (
                  <li key={stage.stageId ?? stage.label}>
                    <strong>{stage.label}</strong>
                    <span>{stage.estimatedTimeframe ?? 'Timing based on progress'}</span>
                  </li>
                ))}
              </ol>
              <div className="roadmap-upgrade-actions">
                <button type="button" onClick={() => setUpgradePreview(null)}>Keep current roadmap</button>
                <button type="button" className="primary" onClick={() => void applyRoadmapUpgrade()}>Apply future-stage update</button>
              </div>
            </div>
          </div>
        );
      })()}

      {stageUpgradePreview && (() => {
        const route = stageUpgradePreview.content.actionPlan?.routes.find((item) => item.isRecommended);
        return (
          <div className="roadmap-upgrade-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setStageUpgradePreview(null); }}>
            <div className="roadmap-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="stage-upgrade-title">
              <h3 id="stage-upgrade-title">Preview improved stage</h3>
              <p>Your checkboxes, evidence, and completion state stay unchanged.</p>
              <div className="stage-upgrade-summary">
                <strong>{stageUpgradePreview.content.label}</strong>
                <span>{stageUpgradePreview.content.estimatedTimeframe ?? 'Timing based on progress'}</span>
                {route && <p><strong>Recommended route:</strong> {route.title}. {route.summary}</p>}
                <p>{route?.roleOptions.length ?? 0} role options · {route?.projectOptions.length ?? 0} project options · {stageUpgradePreview.content.resources?.length ?? 0} courses</p>
              </div>
              <div className="roadmap-upgrade-actions">
                <button type="button" onClick={() => setStageUpgradePreview(null)}>Keep current stage</button>
                <button type="button" className="primary" onClick={() => void applyStageUpgrade()}>Apply improvement</button>
              </div>
            </div>
          </div>
        );
      })()}

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
              cvExcerpt: (() => {
                const fromText = typeof user?.cvText === 'string' ? user.cvText.trim() : '';
                if (fromText.length > 0) {
                  return fromText.slice(0, 4000);
                }
                const fromCv = typeof user?.cv === 'string' ? user.cv.trim() : '';
                if (fromCv.length === 0 || /^s3:\/\//i.test(fromCv) || /^uploads\/cv\//i.test(fromCv)) {
                  return undefined;
                }
                return fromCv.slice(0, 4000);
              })(),
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
