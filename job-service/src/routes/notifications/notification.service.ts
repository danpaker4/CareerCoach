import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";
import type { Notification, NotificationType } from "./notification.model";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  dueDate?: Date;
};

export class NotificationService {
  constructor(private readonly collection: Collection<Notification>) { }

  create = async (input: CreateNotificationInput): Promise<Notification> => {
    const now = new Date();
    const doc: Notification = {
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title.trim(),
      message: input.message.trim(),
      actionUrl: input.actionUrl?.trim() || undefined,
      metadata: input.metadata,
      read: false,
      createdAt: now,
      dueDate: input.dueDate,
    };
    await this.collection.insertOne(doc);
    return doc;
  };

  listForUser = async (userId: string, options: { unreadOnly?: boolean; limit?: number } = {}): Promise<Notification[]> => {
    const filter: Record<string, unknown> = { userId };
    if (options.unreadOnly) filter.read = false;
    const limit = options.limit ?? 50;
    return this.collection.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
  };

  unreadCount = async (userId: string): Promise<number> => {
    return this.collection.countDocuments({ userId, read: false });
  };

  markRead = async (id: string): Promise<Notification | null> => {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: { read: true } },
      { returnDocument: "after" }
    );
    return result ?? null;
  };

  markAllRead = async (userId: string): Promise<number> => {
    const result = await this.collection.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );
    return result.modifiedCount;
  };

  remove = async (id: string): Promise<boolean> => {
    const result = await this.collection.deleteOne({ id });
    return result.deletedCount > 0;
  };

  existsRecentForKey = async (
    userId: string,
    type: NotificationType,
    metadataKey: string,
    metadataValue: string,
    sinceDate: Date
  ): Promise<boolean> => {
    const filter: Record<string, unknown> = {
      userId,
      type,
      createdAt: { $gte: sinceDate },
      [`metadata.${metadataKey}`]: metadataValue,
    };
    const found = await this.collection.findOne(filter);
    return found !== null;
  };
}
