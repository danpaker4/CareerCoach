export type NotificationType =
  | "wanted_job_match"
  | "pipeline_reminder"
  | "system";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
  dueDate?: Date;
};
