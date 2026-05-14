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

export interface ManagementProps {
  currentUser: User;
}

export interface DeleteUserDialogProps {
  user: AdminUserSummary;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}
