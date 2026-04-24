import { isUser } from './lib/authResponse';
import type { User } from './types/user';

export const readUserResponse = async (response: Response): Promise<User | null> => {
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload !== 'object' || payload === null || !('user' in payload)) {
    return null;
  }

  const user = payload.user;
  return isUser(user) ? user : null;
};

export const hasErrorCode = (payload: unknown, errorCode: string): boolean => {
  if (typeof payload !== 'object' || payload === null || !('errorCode' in payload)) {
    return false;
  }

  return payload.errorCode === errorCode;
};
