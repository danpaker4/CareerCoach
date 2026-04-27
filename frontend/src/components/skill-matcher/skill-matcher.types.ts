import type { User } from '../../types/user';

export interface SkillToImprove {
  skill: string;
  isDone: boolean;
}

export interface SkillMatcherData {
  id: string;
  userId: string;
  jobId: number;
  skillToImprove: SkillToImprove[];
}

export interface SkillMatcherProps {
  user?: User;
}

export type FetchState = 'idle' | 'loading' | 'success' | 'error';
