import type { User } from '../../types/user';
import type { CareerRoadmapData } from '../career-roadmap/career-roadmap.types';

export interface SkillToImprove {
  skill: string;
  isDone: boolean;
}

/** One checklist group = one roadmap stage (all action checkboxes). */
export interface RoadmapSkillSet {
  id: string;
  roadmapId: string;
  dreamJob: string;
  stageIndex: number;
  stageLabel: string;
  skillToImprove: SkillToImprove[];
}

export interface SkillMatcherProps {
  user?: User;
}

export type FetchState = 'idle' | 'loading' | 'success' | 'error';

export type { CareerRoadmapData };
