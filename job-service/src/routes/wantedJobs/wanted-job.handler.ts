import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import { createEmbedding, createEmbeddingClient, type EmbeddingClient } from "../../poller/job-poller-api-stack/stages/enrich/embedding";
import type { WantedJob } from "./wanted-job.model";
import type { CreateWantedJobBody } from "./wanted-job.schema";
import { buildWantedJobEmbeddingText, serializeWantedJob } from "./wanted-job.utils";

const dedupeKeywords = (keywords: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
};

export const WantedJobsHandler = (
  wantedJobsCollection: Collection<WantedJob>,
  embeddingClient: EmbeddingClient | null
) => ({
  createWantedJobHandler: async (
    request: FastifyRequest<{ Body: CreateWantedJobBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { userId, jobTitle, keywords, location, seniority, rawText } = request.body;
      const cleanedKeywords = dedupeKeywords(keywords ?? []);
      const trimmedTitle = jobTitle.trim();
      const trimmedRawText = rawText?.trim() ?? "";

      const existing = await wantedJobsCollection.findOne({
        userId,
        jobTitle: trimmedTitle,
        status: "pending",
      });
      if (existing) {
        reply.code(StatusCodes.CREATED).send(serializeWantedJob(existing));
        return;
      }

      const embeddingText = buildWantedJobEmbeddingText({
        jobTitle: trimmedTitle,
        keywords: cleanedKeywords,
        location,
        seniority,
        rawText: trimmedRawText,
      });

      let embedding: number[] = [];
      if (embeddingClient) {
        try {
          embedding = await createEmbedding(embeddingClient, embeddingText);
        } catch (err) {
          request.log.warn({ err }, "Wanted-job embedding failed; storing without vector");
        }
      }

      const now = new Date();
      const doc: WantedJob = {
        id: randomUUID(),
        userId,
        jobTitle: trimmedTitle,
        keywords: cleanedKeywords,
        location: location?.trim() || undefined,
        seniority: seniority?.trim() || undefined,
        rawText: trimmedRawText,
        embedding,
        status: "pending",
        matchedJobIds: [],
        createdAt: now,
        updatedAt: now,
      };

      await wantedJobsCollection.insertOne(doc);
      reply.code(StatusCodes.CREATED).send(serializeWantedJob(doc));
    } catch (error) {
      request.log.error({ err: error }, "Failed to create wanted job");
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
        message: "Failed to create wanted job",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  getWantedJobsHandler: async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { userId } = request.params;
      const docs = await wantedJobsCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();
      reply.code(StatusCodes.OK).send(docs.map(serializeWantedJob));
    } catch (error) {
      request.log.error({ err: error }, "Failed to list wanted jobs");
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to list wanted jobs" });
    }
  },

  deleteWantedJobHandler: async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const result = await wantedJobsCollection.deleteOne({ id });
      if (result.deletedCount === 0) {
        reply.code(StatusCodes.NOT_FOUND).send({ message: "Wanted job not found" });
        return;
      }
      reply.code(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      request.log.error({ err: error }, "Failed to delete wanted job");
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Failed to delete wanted job" });
    }
  },
});

export const buildWantedJobsEmbeddingClient = (): EmbeddingClient | null => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return createEmbeddingClient(apiKey);
};
