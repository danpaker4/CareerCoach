import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { EnrichedJob } from "../../poller/job-poller/stages/enrich/types";
import { JobSearchHandler } from "./job-search.handler";

type RegisterRouter = (fastify: TypedFastify) => void;

export const jobSearchRouter = (jobsCollection: Collection<EnrichedJob>): RegisterRouter => (fastify: TypedFastify): void => {
    const handler = JobSearchHandler(jobsCollection);
    fastify.post("/jobs/search", handler.searchJobs);
};
