import type { User } from '../../types/user';

export interface RoadmapStage {
  jobId: number;
  isDone: boolean;
}

export interface CareerRoadmapData {
  id: string;
  userId: string;
  dreamJob: string;
  stagesToDreamJob: RoadmapStage[];
}

export interface CareerRoadmapProps {
  user?: User;
}

export type FetchState = 'idle' | 'loading' | 'success' | 'error';
