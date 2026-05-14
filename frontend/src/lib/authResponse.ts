import type { User } from '../types/user';

export interface AuthResponse {
  success?: boolean;
  user?: User;
  accessToken?: string;
  error?: string;
}

const parseStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;

const isUserRole = (value: unknown): value is User['role'] => value === 'user' || value === 'admin';

export const normalizeUser = (value: unknown): User | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const user = value as Record<string, unknown>;
  if (
    typeof user.id !== 'string' ||
    typeof user.firstName !== 'string' ||
    typeof user.lastName !== 'string' ||
    typeof user.email !== 'string'
  ) {
    return null;
  }

  if ('role' in user && !isUserRole(user.role)) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: isUserRole(user.role) ? user.role : 'user',
    ...(typeof user.birthDate === 'string' ? { birthDate: user.birthDate } : {}),
    ...(typeof user.currentJob === 'string' ? { currentJob: user.currentJob } : {}),
    ...(typeof user.linkedInUrl === 'string' ? { linkedInUrl: user.linkedInUrl } : {}),
    ...(typeof user.githubUrl === 'string' ? { githubUrl: user.githubUrl } : {}),
    ...(parseStringArray(user.githubSkills) ? { githubSkills: parseStringArray(user.githubSkills) } : {}),
    ...(parseStringArray(user.knownSkills) ? { knownSkills: parseStringArray(user.knownSkills) } : {}),
    ...(typeof user.cv === 'string' ? { cv: user.cv } : {}),
    ...(Array.isArray(user.achievements) ? { achievements: user.achievements as User['achievements'] } : {}),
    ...(parseStringArray(user.technologies) ? { technologies: parseStringArray(user.technologies) } : {}),
    ...(parseStringArray(user.interests) ? { interests: parseStringArray(user.interests) } : {}),
    ...(typeof user.githubId === 'number' ? { githubId: user.githubId } : {}),
    ...(typeof user.avatarUrl === 'string' ? { avatarUrl: user.avatarUrl } : {}),
    ...(typeof user.bio === 'string' ? { bio: user.bio } : {}),
    ...(typeof user.location === 'string' ? { location: user.location } : {}),
    ...(typeof user.company === 'string' ? { company: user.company } : {}),
  };
};

export const isUser = (value: unknown): value is User => normalizeUser(value) !== null;

export const readAuthResponse = async (response: Response): Promise<AuthResponse> => {
  const payload: unknown = await response.json().catch(() => ({}));
  if (typeof payload !== 'object' || payload === null) {
    return {};
  }

  const user = 'user' in payload ? normalizeUser(payload.user) : null;

  return {
    success: 'success' in payload && payload.success === true,
    user: user ?? undefined,
    accessToken: 'accessToken' in payload && typeof payload.accessToken === 'string' ? payload.accessToken : undefined,
    error: 'error' in payload && typeof payload.error === 'string' ? payload.error : undefined,
  };
};
