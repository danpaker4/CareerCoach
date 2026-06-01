import type { User } from '../../types/user';

export type ResourceType = 'course' | 'video' | 'practice' | 'article' | 'docs' | 'repository' | 'certification';

export interface StageResource {
  title: string;
  platform: string;
  url: string;
  type?: ResourceType;
}

export interface StageContent {
  label: string;
  description: string;
  actions: string[];
  resources?: StageResource[];
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
