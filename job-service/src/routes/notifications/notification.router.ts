import type { Collection } from "mongodb";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Notification } from "./notification.model";
import type { PipelineJob } from "../jobsInPipeline/pipeline-job.model";
import { NotificationHandler } from "./notification.handler";
import {
  checkPipelineRemindersSchema,
  createNotificationSchema,
  deleteNotificationSchema,
  getNotificationsSchema,
  getUnreadCountSchema,
  markAllReadSchema,
  markReadSchema,
} from "./notification.schema";

export const notificationsRouter = (
  notificationsCollection: Collection<Notification>,
  pipelineJobsCollection: Collection<PipelineJob>
) => async (fastify: FastifyInstance) => {
  const handler = NotificationHandler(notificationsCollection, pipelineJobsCollection);
  const typed = fastify.withTypeProvider<ZodTypeProvider>();

  typed.post("/notifications", { schema: createNotificationSchema }, handler.createHandler);
  typed.get("/notifications/:userId", { schema: getNotificationsSchema }, handler.listHandler);
  typed.get("/notifications/:userId/unread-count", { schema: getUnreadCountSchema }, handler.unreadCountHandler);
  typed.patch("/notifications/:id/read", { schema: markReadSchema }, handler.markReadHandler);
  typed.patch("/notifications/:userId/read-all", { schema: markAllReadSchema }, handler.markAllReadHandler);
  typed.delete("/notifications/:id", { schema: deleteNotificationSchema }, handler.deleteHandler);
  typed.post(
    "/notifications/:userId/check-pipeline-reminders",
    { schema: checkPipelineRemindersSchema },
    handler.checkPipelineRemindersHandler
  );
};
