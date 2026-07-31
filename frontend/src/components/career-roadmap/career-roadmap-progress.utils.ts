import type { RoadmapStage, StageContent } from './career-roadmap.types';

export const resolveStageActions = (stage: RoadmapStage, fallbackActions: readonly string[] = []): string[] =>
  stage.content?.actions ?? [...fallbackActions];

export const hasCompletionCriteria = (content: StageContent | undefined): boolean =>
  Array.isArray(content?.completionCriteria) && (content?.completionCriteria?.length ?? 0) > 0;

export const isStageCompleteByCriteria = (stage: RoadmapStage): boolean => {
  const criteria = stage.content?.completionCriteria ?? [];
  if (criteria.length === 0) return false;
  const completed = new Set(stage.completedCriterionIds ?? []);
  return criteria.every((criterion) => completed.has(criterion.id));
};

export const resolveStageProgressRatio = (stage: RoadmapStage, fallbackActions: readonly string[] = []): number => {
  if (stage.isDone) return 1;

  const criteria = stage.content?.completionCriteria ?? [];
  if (criteria.length > 0) {
    const completed = new Set(stage.completedCriterionIds ?? []);
    const doneCount = criteria.filter((criterion) => completed.has(criterion.id)).length;
    return doneCount / criteria.length;
  }

  const actions = resolveStageActions(stage, fallbackActions);
  if (actions.length === 0) return 0;
  const doneActions = (stage.completedActions ?? []).filter((action) => actions.includes(action)).length;
  return doneActions / actions.length;
};

export const resolveStageDoneAfterActionToggle = (params: {
  readonly stage: RoadmapStage;
  readonly nextCompletedActions: readonly string[];
  readonly fallbackActions?: readonly string[];
}): boolean => {
  const criteria = params.stage.content?.completionCriteria ?? [];
  if (criteria.length > 0) {
    return isStageCompleteByCriteria({
      ...params.stage,
      completedActions: [...params.nextCompletedActions],
    });
  }
  const actions = resolveStageActions(params.stage, params.fallbackActions ?? []);
  return actions.length > 0 && actions.every((action) => params.nextCompletedActions.includes(action));
};
