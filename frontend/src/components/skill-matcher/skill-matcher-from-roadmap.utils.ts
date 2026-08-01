import type { CareerRoadmapData, RoadmapStage } from '../career-roadmap/career-roadmap.types';
import type { RoadmapSkillSet, SkillToImprove } from './skill-matcher.types';

const FALLBACK_STAGE_LABEL = 'Milestone';

export const parseCareerRoadmaps = (data: unknown): CareerRoadmapData[] => {
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

const resolveStageActions = (stage: RoadmapStage): string[] =>
  Array.isArray(stage.content?.actions)
    ? stage.content.actions.filter((action): action is string => typeof action === 'string' && action.trim().length > 0)
    : [];

const resolveStageLabel = (stage: RoadmapStage, stageIndex: number): string => {
  const label = stage.content?.label?.trim();
  if (label) return label;
  return `${FALLBACK_STAGE_LABEL} ${stageIndex + 1}`;
};

const mapStageActionsToSkills = (stage: RoadmapStage): SkillToImprove[] => {
  const actions = resolveStageActions(stage);
  if (actions.length === 0) return [];
  const completed = new Set(stage.isDone ? actions : (stage.completedActions ?? []));
  return actions.map((skill) => ({
    skill,
    isDone: completed.has(skill),
  }));
};

export const buildSkillSetsFromRoadmaps = (roadmaps: readonly CareerRoadmapData[]): RoadmapSkillSet[] => {
  const sets: RoadmapSkillSet[] = [];
  for (const roadmap of roadmaps) {
    roadmap.stagesToDreamJob.forEach((stage, stageIndex) => {
      const skillToImprove = mapStageActionsToSkills(stage);
      if (skillToImprove.length === 0) return;
      sets.push({
        id: `${roadmap.id}:${stageIndex}`,
        roadmapId: roadmap.id,
        dreamJob: roadmap.dreamJob,
        stageIndex,
        stageLabel: resolveStageLabel(stage, stageIndex),
        skillToImprove,
      });
    });
  }
  return sets;
};

export const summarizeSkillProgress = (sets: readonly RoadmapSkillSet[]): { total: number; done: number; pct: number } => {
  const all = sets.flatMap((set) => set.skillToImprove);
  const total = all.length;
  const done = all.filter((item) => item.isDone).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
};

export const toggleRoadmapAction = (params: {
  readonly roadmaps: readonly CareerRoadmapData[];
  readonly roadmapId: string;
  readonly stageIndex: number;
  readonly action: string;
}): CareerRoadmapData[] => {
  return params.roadmaps.map((roadmap) => {
    if (roadmap.id !== params.roadmapId) return roadmap;

    const updatedStages = roadmap.stagesToDreamJob.map((stage, idx) => {
      if (idx !== params.stageIndex) return stage;

      const actions = resolveStageActions(stage);
      if (actions.length === 0 || !actions.includes(params.action)) return stage;

      const current = stage.isDone ? [...actions] : [...(stage.completedActions ?? [])];
      const nextCompleted = current.includes(params.action)
        ? current.filter((item) => item !== params.action)
        : [...current, params.action];
      const allDone = actions.every((item) => nextCompleted.includes(item));

      return {
        ...stage,
        completedActions: nextCompleted,
        isDone: allDone,
      };
    });

    return { ...roadmap, stagesToDreamJob: updatedStages };
  });
};
