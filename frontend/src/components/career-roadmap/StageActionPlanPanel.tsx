import { useState } from 'react';
import type { ActionableRoute, RecommendedProject, RoadmapStage } from './career-roadmap.types';
import { StageOpportunitiesPanel } from './StageOpportunitiesPanel';

type StageActionPlanPanelProps = {
  stage: RoadmapStage;
  userId: string;
  userSkills?: string[];
  onUpdate: (changes: Partial<RoadmapStage>) => Promise<boolean>;
};

const sourceLabel = (source: ActionableRoute['source']): string => ({
  'profile-match': 'Profile match',
  'job-market': 'Job-market evidence',
  'employer-signal': 'Employer job-posting signal',
  'reviewed-template': 'Reviewed template',
  'ai-personalized': 'AI-personalized suggestion',
})[source];

const ProjectBrief = ({ project, selected, completed, onSelect, onToggleCompleted, onDismiss }: {
  project: RecommendedProject;
  selected: boolean;
  completed: boolean;
  onSelect: () => void;
  onToggleCompleted: () => void;
  onDismiss: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [guidanceExpanded, setGuidanceExpanded] = useState(false);
  return (
    <article className={`stage-project${selected ? ' stage-project--selected' : ''}${completed ? ' stage-project--completed' : ''}`}>
      <div className="stage-project-head">
        <div><h6>{project.title}</h6><span>{project.level} · ~{project.estimatedHours} hours</span></div>
        {(selected || completed) && <span className="stage-plan-selected-badge">{completed ? 'Completed' : 'Active project'}</span>}
      </div>
      <div className="stage-plan-item-actions">
        <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Hide project details' : 'Load project details'}</button>
        {!selected && <button type="button" onClick={onSelect}>Choose project</button>}
        <label className="stage-project-complete"><input type="checkbox" checked={completed} onChange={onToggleCompleted} /> I completed this project</label>
        <button type="button" className="stage-plan-dismiss" onClick={onDismiss}>Not suitable</button>
      </div>
      {expanded && (
        <div className="stage-project-brief">
          <p><strong>Objective:</strong> {project.objective}</p>
          <strong>Tasks in order</strong>
          <ol>{project.tasks.map((task) => <li key={task}>{task}</li>)}</ol>
          <strong>Deliverables</strong>
          <ul>{project.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
          <strong>Completion checklist</strong>
          <ul>{project.completionChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
          <p><strong>Helps with:</strong> {project.roleRelevance}</p>
          <button type="button" className="stage-project-guidance-toggle" onClick={() => setGuidanceExpanded((value) => !value)}>
            {guidanceExpanded ? 'Hide guidance' : 'More guidance'}
          </button>
          {guidanceExpanded && <ul>{project.optionalGuidance.map((item) => <li key={item}>{item}</li>)}</ul>}
        </div>
      )}
    </article>
  );
};

export const StageActionPlanPanel = ({ stage, userId, userSkills, onUpdate }: StageActionPlanPanelProps) => {
  const plan = stage.content?.actionPlan;
  const dismissed = new Set(stage.dismissedRecommendationIds ?? []);
  const initialRoute = plan?.routes.find((route) => route.id === stage.selectedRouteId)
    ?? plan?.routes.find((route) => route.id === plan.recommendedRouteId)
    ?? plan?.routes[0];
  const [activeRouteId, setActiveRouteId] = useState(initialRoute?.id ?? '');
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showMoreRoles, setShowMoreRoles] = useState(false);
  const [showMoreProjects, setShowMoreProjects] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!plan || !initialRoute) return null;

  const activeRoute = plan.routes.find((route) => route.id === activeRouteId) ?? initialRoute;
  const availableRoles = activeRoute.roleOptions.filter((role) => !dismissed.has(role.id));
  const availableProjects = activeRoute.projectOptions.filter((project) => !dismissed.has(project.id));
  const visibleRoles = availableRoles.slice(0, showMoreRoles ? 6 : 3);
  const visibleProjects = availableProjects.slice(0, showMoreProjects ? 6 : 3);

  const save = async (changes: Partial<RoadmapStage>) => {
    setSaving(true);
    const saved = await onUpdate(changes);
    setSaving(false);
    return saved;
  };

  const chooseRoute = async (route: ActionableRoute) => {
    if (await save({ selectedRouteId: route.id, selectedProjectId: undefined })) {
      setActiveRouteId(route.id);
      setShowAlternatives(false);
    }
  };

  const dismiss = async (id: string) => {
    await save({ dismissedRecommendationIds: [...dismissed, id] });
  };

  return (
    <section className="stage-action-plan">
      <header className="stage-action-plan-head">
        <div><span>Your practical route</span><h5>{activeRoute.title}</h5></div>
        <span className="stage-plan-selected-badge">{activeRoute.isRecommended ? 'Recommended for you' : 'Your selected route'}</span>
      </header>
      <p>{activeRoute.summary}</p>
      <div className="stage-route-next-actions">
        <strong>Complete this route when:</strong>
        <span>{activeRoute.completionRule}</span>
      </div>
      <button type="button" className="stage-plan-why" onClick={() => setWhyExpanded((value) => !value)}>
        {whyExpanded ? 'Hide recommendation reason' : 'Why this recommendation?'}
      </button>
      {whyExpanded && <p className="stage-plan-reason">{activeRoute.whyRecommended} · {sourceLabel(activeRoute.source)} · {activeRoute.confidence} confidence</p>}

      {activeRoute.missionOptions.filter((mission) => !dismissed.has(mission.id)).map((mission) => (
        <details key={mission.id} className="stage-mission">
          <summary>{mission.title}<span>Potential internal mission</span></summary>
          <p><strong>Ask your manager:</strong> “{mission.requestToManager}”</p>
          <strong>Responsibilities to request</strong>
          <ul>{mission.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
          <strong>Target outcomes</strong>
          <ul>{mission.outcomes.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>{mission.fallback}</p>
          <button type="button" className="stage-plan-dismiss" onClick={() => void dismiss(mission.id)}>Not suitable</button>
        </details>
      ))}

      {visibleRoles.length > 0 && (
        <details className="stage-plan-section stage-plan-section-dropdown">
          <summary>
            <span>Jobs that build this experience</span>
            <span className="stage-dropdown-meta"><small>{availableRoles.length} options</small><span className="journey-caret" aria-hidden="true" /></span>
          </summary>
          <div className="stage-role-list">
            {visibleRoles.map((role) => (
              <article key={role.id} className="stage-role-option">
                <div><strong>{role.title}</strong><span>{role.fit === 'pursue-now' ? 'Pursue now' : 'Prepare first'}{role.internalMoveSuitable ? ' · Potential internal move' : ''}</span></div>
                <p>{role.experienceGained}</p>
                <details><summary>Why this role?</summary><p>{role.whyItFits}</p>{role.missingRequirements.length > 0 && <p><strong>Prepare:</strong> {role.missingRequirements.join(', ')}</p>}</details>
                <div className="stage-plan-item-actions">
                  <StageOpportunitiesPanel roleCategories={[role.title]} userId={userId} userSkills={userSkills} />
                  <button type="button" className="stage-plan-dismiss" onClick={() => void dismiss(role.id)}>Not suitable</button>
                </div>
              </article>
            ))}
          </div>
          {availableRoles.length > 3 && <button type="button" className="stage-plan-more" onClick={() => setShowMoreRoles((value) => !value)}>{showMoreRoles ? 'Show fewer roles' : 'Show more roles'}</button>}
        </details>
      )}

      {visibleProjects.length > 0 && (
        <details className="stage-plan-section stage-plan-section-dropdown">
          <summary>
            <span>Projects you can choose</span>
            <span className="stage-dropdown-meta"><small>{availableProjects.length} options</small><span className="journey-caret" aria-hidden="true" /></span>
          </summary>
          <div className="stage-project-list">
            {visibleProjects.map((project) => (
              <ProjectBrief
                key={project.id}
                project={project}
                selected={stage.selectedProjectId === project.id}
                completed={(stage.completedProjectIds ?? []).includes(project.id)}
                onSelect={() => void save({ selectedProjectId: project.id })}
                onToggleCompleted={() => {
                  const completedProjectIds = stage.completedProjectIds ?? [];
                  const next = completedProjectIds.includes(project.id)
                    ? completedProjectIds.filter((id) => id !== project.id)
                    : [...completedProjectIds, project.id];
                  void save({ completedProjectIds: next });
                }}
                onDismiss={() => void dismiss(project.id)}
              />
            ))}
          </div>
          {availableProjects.length > 3 && <button type="button" className="stage-plan-more" onClick={() => setShowMoreProjects((value) => !value)}>{showMoreProjects ? 'Show fewer projects' : 'Show more projects'}</button>}
        </details>
      )}

      <button type="button" className="stage-route-alternatives-toggle" onClick={() => setShowAlternatives((value) => !value)}>{showAlternatives ? 'Hide other routes' : 'Other routes'}</button>
      {showAlternatives && (
        <div className="stage-route-alternatives">
          {plan.routes.filter((route) => route.id !== activeRoute.id).map((route) => (
            <article key={route.id}><div><strong>{route.title}</strong><p>{route.summary}</p></div><button type="button" onClick={() => void chooseRoute(route)} disabled={saving}>Choose route</button></article>
          ))}
        </div>
      )}
    </section>
  );
};
