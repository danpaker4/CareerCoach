import type { User } from '../../types/user';

export interface StageContent {
  label: string;
  description: string;
  actions: string[];
  estimatedTimeframe?: string;
}

export interface RoadmapStage {
  jobId: number;
  isDone: boolean;
  content?: StageContent;
}

export interface CareerRoadmapData {
  id: string;
  userId: string;
  dreamJob: string;
  stagesToDreamJob: RoadmapStage[];
  generatedAt?: string;
}

export interface CareerRoadmapProps {
  user?: User;
}

export interface RoadmapGenerationResponse {
  stages: StageContent[];
}

export type FetchState = 'idle' | 'loading' | 'success' | 'error';
