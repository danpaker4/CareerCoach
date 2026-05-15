import { ADMIN_DELETE_USER_PATH, ADMIN_DEMOTE_PATH, ADMIN_LLM_TOKEN_USAGE_PATH, ADMIN_USERS_PATH } from './management.consts';
import type { AdminLlmTokenUsageResult, AdminLlmTokenUsageSeriesItem, AdminUserSummary, LlmProvider } from './management.types';

export const isAdminUserSummary = (value: unknown): value is AdminUserSummary => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string' &&
    typeof user.email === 'string' &&
    (user.role === 'user' || user.role === 'admin')
  );
};

export const parseAdminUsers = (value: unknown): AdminUserSummary[] =>
  Array.isArray(value) ? value.filter(isAdminUserSummary) : [];

export const readManagementErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
};

export const buildAdminUsersUrl = (searchQuery: string): string => {
  const trimmedQuery = searchQuery.trim();
  if (trimmedQuery.length === 0) {
    return ADMIN_USERS_PATH;
  }

  const params = new URLSearchParams({ query: trimmedQuery });
  return `${ADMIN_USERS_PATH}?${params.toString()}`;
};

export const buildDemoteAdminUrl = (userId: string): string => `${ADMIN_DEMOTE_PATH}/${encodeURIComponent(userId)}`;

export const buildDeleteUserUrl = (userId: string): string => `${ADMIN_DELETE_USER_PATH}/${encodeURIComponent(userId)}`;

export const getAdminUserDisplayName = (user: AdminUserSummary): string =>
  `${user.firstName} ${user.lastName}`.trim();

const isLlmProvider = (value: unknown): value is LlmProvider =>
  value === 'gemini' || value === 'openai' || value === 'custom' || value === 'ollama';

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isTokenUsageSeriesItem = (value: unknown): value is AdminLlmTokenUsageSeriesItem => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.date === 'string' &&
    isLlmProvider(item.provider) &&
    typeof item.model === 'string' &&
    isNumber(item.promptTokens) &&
    isNumber(item.completionTokens) &&
    isNumber(item.totalTokens) &&
    isNumber(item.requestCount) &&
    isNumber(item.unknownRequestCount)
  );
};

export const parseTokenUsage = (value: unknown): AdminLlmTokenUsageResult | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const range = payload.range;
  if (typeof range !== 'object' || range === null || !Array.isArray(payload.series)) {
    return null;
  }

  const rangeRecord = range as Record<string, unknown>;
  if (
    typeof rangeRecord.from !== 'string' ||
    typeof rangeRecord.to !== 'string' ||
    !isNumber(rangeRecord.days)
  ) {
    return null;
  }

  return {
    range: {
      from: rangeRecord.from,
      to: rangeRecord.to,
      days: rangeRecord.days,
    },
    series: payload.series.filter(isTokenUsageSeriesItem),
  };
};

export const buildAdminLlmTokenUsageUrl = (days = 30): string => {
  const params = new URLSearchParams({ days: String(days) });
  return `${ADMIN_LLM_TOKEN_USAGE_PATH}?${params.toString()}`;
};
