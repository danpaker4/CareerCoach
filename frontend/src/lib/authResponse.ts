import type { User } from '../types/user';

export interface AuthResponse {
  success?: boolean;
  user?: User;
  accessToken?: string;
  error?: string;
}

export const isUser = (value: unknown): value is User => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Partial<User>;
  return (
    typeof user.id === 'string' &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string' &&
    typeof user.email === 'string'
  );
};

export const readAuthResponse = async (response: Response): Promise<AuthResponse> => {
  const payload: unknown = await response.json().catch(() => ({}));
  if (typeof payload !== 'object' || payload === null) {
    return {};
  }

  return {
    success: 'success' in payload && payload.success === true,
    user: 'user' in payload && isUser(payload.user) ? payload.user : undefined,
    accessToken: 'accessToken' in payload && typeof payload.accessToken === 'string' ? payload.accessToken : undefined,
    error: 'error' in payload && typeof payload.error === 'string' ? payload.error : undefined,
  };
};
