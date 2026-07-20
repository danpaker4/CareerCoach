import type { ThemeMode } from '../../lib/theme';

export interface HeaderProps {
  userName?: string;
  isAdmin?: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
}
