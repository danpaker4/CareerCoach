import type { FastifyRequest, FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { RoadmapGenerationService } from "./roadmap-generation.service";
import type { RoadmapGenerationRequestBody } from "./roadmap-generation.types";
import { MAX_TARGET_YEARS, MIN_TARGET_YEARS } from "./roadmap-generation.consts";

export class RoadmapGenerationController {
    constructor(private readonly service: RoadmapGenerationService) {}

    generate = async (
        request: FastifyRequest<{ Body: RoadmapGenerationRequestBody }>,
        reply: FastifyReply
    ): Promise<void> => {
        const body = request.body as RoadmapGenerationRequestBody | undefined;
        if (!body || typeof body !== "object") {
            reply.code(StatusCodes.BAD_REQUEST).send({ error: "Request body is required" });
            return;
        }

        const { userId, dreamJob, targetYears } = body;

        if (
            !userId ||
            !dreamJob?.trim() ||
            !targetYears ||
            !Number.isInteger(targetYears) ||
            targetYears < MIN_TARGET_YEARS ||
            targetYears > MAX_TARGET_YEARS
        ) {
            reply.code(StatusCodes.BAD_REQUEST).send({
                error: `userId (UUID), dreamJob (non-empty string), and targetYears (integer ${MIN_TARGET_YEARS}-${MAX_TARGET_YEARS}) are required`,
            });
            return;
        }

        try {
            const result = await this.service.generate(userId, dreamJob.trim(), targetYears);
            reply.code(StatusCodes.OK).send(result);
        } catch (error) {
            request.log.error({ err: error }, "Roadmap generation failed");
            reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed to generate roadmap. Please try again.",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
