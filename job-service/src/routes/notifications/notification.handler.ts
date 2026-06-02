import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { Notification } from "./notification.model";
import type { PipelineJob } from "../jobsInPipeline/pipeline-job.model";
import type { CreateNotificationBody } from "./notification.schema";
import { NotificationService } from "./notification.service";
import { serializeNotification } from "./notification.utils";

const PIPELINE_REMINDER_STAGES = ["applied", "interview", "interviewing"] as const;
const PIPELINE_REMINDER_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PIPELINE_REMINDER_DEDUPE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const isStaleStage = (stage: string): boolean =>
  PIPELINE_REMINDER_STAGES.includes(stage.toLowerCase() as typeof PIPELINE_REMINDER_STAGES[number]);

export const NotificationHandler = (
  notificationsCollection: Collection<Notification>,
  pipelineJobsCollection: Collection<PipelineJob>
) => {
  const service = new NotificationService(notificationsCollection);

  return {
    createHandler: async (
      request: FastifyRequest<{ Body: CreateNotificationBody }>,
      reply: FastifyReply
    ) => {
      try {
        const doc = await service.create({
          ...request.body,
          dueDate: request.body.dueDate ? new Date(request.body.dueDate) : undefined,
        });
        reply.code(StatusCodes.CREATED).send(serializeNotification(doc));
      } catch (error) {
        request.log.error({ err: error }, "Failed to create notification");
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to create notification" });
      }
    },

    listHandler: async (
      request: FastifyRequest<{ Params: { userId: string }; Querystring: { unreadOnly?: string; limit?: number } }>,
      reply: FastifyReply
    ) => {
      try {
        const items = await service.listForUser(request.params.userId, {
          unreadOnly: request.query.unreadOnly === "true",
          limit: request.query.limit,
        });
        reply.code(StatusCodes.OK).send(items.map(serializeNotification));
      } catch (error) {
        request.log.error({ err: error }, "Failed to list notifications");
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to list notifications" });
      }
    },

    unreadCountHandler: async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const count = await service.unreadCount(request.params.userId);
        reply.code(StatusCodes.OK).send({ unread: count });
      } catch (error) {
        request.log.error({ err: error }, "Failed to count unread notifications");
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to count unread notifications" });
      }
    },

    markReadHandler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const updated = await service.markRead(request.params.id);
        if (!updated) {
          reply.code(StatusCodes.NOT_FOUND).send({ message: "Notification not found" });
          return;
        }
        reply.code(StatusCodes.OK).send(serializeNotification(updated));
      } catch (error) {
        request.log.error({ err: error }, "Failed to mark notification read");
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to mark notification read" });
      }
    },

    markAllReadHandler: async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const modified = await service.markAllRead(request.params.userId);
        reply.code(StatusCodes.OK).send({ modified });
      } catch (error) {
        request.log.error({ err: error }, "Failed to mark all read");
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to mark all read" });
      }
    },

    deleteHandler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const ok = await service.remove(request.params.id);
        if (!ok) {
          reply.code(StatusCodes.NOT_FOUND).send({ message: "Notification not found" });
          return;
        }
        reply.code(StatusCodes.NO_CONTENT).send();
      } catch (error) {
        request.log.error({ err: error }, "Failed to delete notification");
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to delete notification" });
      }
    },

    checkPipelineRemindersHandler: async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;
        const now = new Date();
        const staleSince = new Date(now.getTime() - PIPELINE_REMINDER_AGE_MS);
        const dedupeSince = new Date(now.getTime() - PIPELINE_REMINDER_DEDUPE_WINDOW_MS);

        const candidates = await pipelineJobsCollection
          .find({ userId })
          .toArray();

        const stale = candidates.filter((job) => {
          if (!job.createdAt) return false;
          if (!isStaleStage(job.jobStage)) return false;
          const created = new Date(job.createdAt);
          return created.getTime() <= staleSince.getTime();
        });

        let created = 0;
        for (const job of stale) {
          const dedupeKey = job.id;
          const exists = await service.existsRecentForKey(
            userId,
            "pipeline_reminder",
            "pipelineJobId",
            dedupeKey,
            dedupeSince
          );
          if (exists) continue;
          await service.create({
            userId,
            type: "pipeline_reminder",
            title: "Follow up on a stalled application",
            message: `Your application "${job.description}" has been in ${job.jobStage} for over a week. Consider sending a follow-up or moving it forward.`,
            actionUrl: "/pipeline",
            metadata: { pipelineJobId: dedupeKey, stage: job.jobStage },
          });
          created++;
        }
        reply.code(StatusCodes.OK).send({ created });
      } catch (error) {
        request.log.error({ err: error }, "Failed to check pipeline reminders");
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to check pipeline reminders" });
      }
    },
  };
};
