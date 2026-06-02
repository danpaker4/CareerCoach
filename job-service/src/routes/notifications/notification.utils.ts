import type { Notification } from "./notification.model";

export const serializeNotification = (doc: Notification) => ({
  id: doc.id,
  userId: doc.userId,
  type: doc.type,
  title: doc.title,
  message: doc.message,
  actionUrl: doc.actionUrl ?? undefined,
  metadata: doc.metadata ?? undefined,
  read: doc.read,
  createdAt: doc.createdAt.toISOString(),
  dueDate: doc.dueDate ? doc.dueDate.toISOString() : undefined,
});
