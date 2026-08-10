import type { ThemeMode } from '../../lib/theme';

export interface HeaderProps {
  userId?: string;
  userName?: string;
  isAdmin?: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
}
