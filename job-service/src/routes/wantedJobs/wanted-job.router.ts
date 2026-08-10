import type { Collection } from "mongodb";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { WantedJob } from "./wanted-job.model";
import {
  buildWantedJobsEmbeddingClient,
  WantedJobsHandler,
} from "./wanted-job.handler";
import {
  createWantedJobSchema,
  deleteWantedJobSchema,
  getWantedJobsSchema,
} from "./wanted-job.schema";

export const wantedJobsRouter = (
  wantedJobsCollection: Collection<WantedJob>
) => async (fastify: FastifyInstance) => {
  const embeddingClient = buildWantedJobsEmbeddingClient();
  const handler = WantedJobsHandler(wantedJobsCollection, embeddingClient);
  const typed = fastify.withTypeProvider<ZodTypeProvider>();

  typed.post("/wanted-jobs", { schema: createWantedJobSchema }, handler.createWantedJobHandler);
  typed.get("/wanted-jobs/:userId", { schema: getWantedJobsSchema }, handler.getWantedJobsHandler);
  typed.delete("/wanted-jobs/:id", { schema: deleteWantedJobSchema }, handler.deleteWantedJobHandler);
};
