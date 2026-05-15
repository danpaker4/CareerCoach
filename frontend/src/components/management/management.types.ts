import type { User, UserRole } from '../../types/user';

export interface AdminUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export type ManagementStatus = 'loading' | 'success' | 'error';

export type ManagementUserAction = 'promote' | 'demote' | 'delete';

export type LlmProvider = 'gemini' | 'openai' | 'custom' | 'ollama';

export interface AdminLlmTokenUsageSeriesItem {
  date: string;
  provider: LlmProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  unknownRequestCount: number;
}

export interface AdminLlmTokenUsageResult {
  range: {
    from: string;
    to: string;
    days: number;
  };
  series: AdminLlmTokenUsageSeriesItem[];
}

export type TokenUsageStatus = 'loading' | 'success' | 'error';

export interface ManagementProps {
  currentUser: User;
}

export interface DeleteUserDialogProps {
  user: AdminUserSummary;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface TokenUsageGraphProps {
  usage: AdminLlmTokenUsageResult | null;
  status: TokenUsageStatus;
  error: string;
}
