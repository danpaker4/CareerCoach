import type { Collection } from "mongodb";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { WantedJob } from "../wantedJobs/wanted-job.model";
import { findMatchingWantedJobs, markWantedJobMatched } from "../wantedJobs/wanted-job.matcher";
import type { NotificationBroker } from "./notification.broker";
import type { NotificationService } from "./notification.service";

const truncate = (text: string, length: number): string =>
  text.length <= length ? text : text.slice(0, length - 1).trimEnd() + "…";

export const dispatchWantedJobMatches = async (params: {
  job: EnrichedJob;
  wantedJobsCollection: Collection<WantedJob>;
  notificationService: NotificationService;
  broker: NotificationBroker;
}): Promise<void> => {
  const { job, wantedJobsCollection, notificationService, broker } = params;
  try {
    const matches = await findMatchingWantedJobs(job, wantedJobsCollection);
    for (const match of matches) {
      const { wantedJob, score, method } = match;
      const companyPart = job.company?.trim() ? ` at ${job.company.trim()}` : "";
      const summary = truncate(job.description?.trim() ?? "", 160);
      const notification = await notificationService.create({
        userId: wantedJob.userId,
        type: "wanted_job_match",
        title: `We found the job you've been waiting for`,
        message: `${job.jobTitle}${companyPart} matches your wanted role "${wantedJob.jobTitle}".${summary ? ` ${summary}` : ""}`,
        actionUrl: "/job-suggestions",
        metadata: {
          jobId: job.id,
          wantedJobId: wantedJob.id,
          score,
          method,
        },
      });
      await markWantedJobMatched(wantedJobsCollection, wantedJob.id, job.id);
      broker.broadcast(wantedJob.userId, notification);
      console.info(
        `[NOTIFICATIONS] wanted-job match userId=${wantedJob.userId} wantedJobId=${wantedJob.id} jobId=${job.id} score=${score.toFixed(3)} method=${method}`
      );
    }
  } catch (error) {
    console.warn("[NOTIFICATIONS] wanted-job dispatch failed", error);
  }
};
