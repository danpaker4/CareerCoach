import type { User } from '../../types/user';

export type ResourceType = 'course' | 'video' | 'practice' | 'article' | 'docs' | 'repository' | 'certification';

export type ProgressionType = 'learning' | 'experience' | 'hybrid';

export interface StageResource {
  title: string;
  platform: string;
  url: string;
  type?: ResourceType;
}

export interface GapAnalysisSnapshot {
  skillsPresent: string[];
  skillsMissing: string[];
  responsibilitiesMissing: string[];
  leadershipGaps: string[];
  architectureGaps: string[];
  domainGaps: string[];
  experienceGapSummary: string;
}

export interface CompletionCriterion {
  id: string;
  description: string;
  metric: 'actions_complete' | 'hours_logged' | 'artifact_ready' | 'self_attest';
  targetValue: number;
}

export interface TimelineMeta {
  effortHours: number;
  hoursPerWeek: number;
  estimatedWeeks: number;
  assumedAvailability: boolean;
}

export interface CareerProgressionMeta {
  currentRoleSummary?: string;
  dreamRoleCategory: string;
  estimatedYearsToGoal?: string;
  progressionReasoning?: string;
  gapAnalysis?: GapAnalysisSnapshot;
  generationVersion?: string;
  generationMode?: string;
}

export interface StageContent {
  label: string;
  description: string;
  actions: string[];
  resources?: StageResource[];
  estimatedTimeframe?: string;
  whyItMatters?: string;
  howToGetThere?: string;
  whatYouGain?: string;
  progressionType?: ProgressionType;
  requiredCapabilities?: string[];
  skillsToBuild?: string[];
  responsibilitiesToGain?: string[];
  experienceAccumulation?: string;
  roleCategories?: string[];
  futureOpportunities?: string[];
  templateId?: string;
  capabilityIds?: string[];
  gapIds?: string[];
  completionCriteria?: CompletionCriterion[];
  timelineMeta?: TimelineMeta;
  reasonCodes?: string[];
}

export interface RoadmapStage {
  jobId: number;
  isDone: boolean;
  content?: StageContent;
  completedActions?: string[];
  completedCriterionIds?: string[];
}

export interface CareerRoadmapData {
  id: string;
  userId: string;
  dreamJob: string;
  stagesToDreamJob: RoadmapStage[];
  generatedAt?: string;
  progressionMeta?: CareerProgressionMeta;
}

export interface CareerRoadmapProps {
  user?: User;
}

export interface RoadmapGenerationResponse {
  stages: StageContent[];
  progressionMeta?: CareerProgressionMeta;
  gapAnalysis?: GapAnalysisSnapshot;
  generationVersion?: string;
  generationMode?: string;
}

export interface StageOpportunity {
  jobId: string;
  title: string;
  company: string;
  seniority: string;
  url: string;
  relevanceReason: string;
}

export interface StageOpportunitiesResponse {
  opportunities: StageOpportunity[];
}

export type FetchState = 'idle' | 'loading' | 'success' | 'error';
