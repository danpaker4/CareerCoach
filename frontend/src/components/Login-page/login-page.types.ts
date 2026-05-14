import type { User } from '../../types/user';

export interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}
