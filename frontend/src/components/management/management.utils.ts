import { ADMIN_DELETE_USER_PATH, ADMIN_DEMOTE_PATH, ADMIN_USERS_PATH } from './management.consts';
import type { AdminUserSummary } from './management.types';

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
