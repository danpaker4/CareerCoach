import type { User } from '../../types/user';

export type PipelineStage = 'wishlist' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface PipelineJob {
  id: string;
  userId: string;
  jobId: number;
  jobStage: string;
  description: string;
}

export interface PipelineColumn {
  id: PipelineStage;
  label: string;
  badgeClass: string;
}

export interface NewJobForm {
  description: string;
  jobStage: PipelineStage;
  jobId: number;
}

export interface PipelineProps {
  user?: User;
}

export type FetchState = 'idle' | 'loading' | 'success' | 'error';
