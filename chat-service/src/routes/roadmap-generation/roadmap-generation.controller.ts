import type { FastifyRequest, FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { RoadmapGenerationService } from "./roadmap-generation.service";
import type { RoadmapGenerationRequestBody } from "./roadmap-generation.types";

export class RoadmapGenerationController {
    constructor(private readonly service: RoadmapGenerationService) {}

    generate = async (
        request: FastifyRequest<{ Body: RoadmapGenerationRequestBody }>,
        reply: FastifyReply
    ): Promise<void> => {
        const { userId, dreamJob, stageCount } = request.body;

        if (
            !userId ||
            !dreamJob?.trim() ||
            !stageCount ||
            stageCount < 2 ||
            stageCount > 5
        ) {
            reply.code(StatusCodes.BAD_REQUEST).send({
                error: "userId (UUID), dreamJob (non-empty string), and stageCount (2-5) are required",
            });
            return;
        }

        try {
            const result = await this.service.generate(userId, dreamJob.trim(), stageCount);
            reply.code(StatusCodes.OK).send(result);
        } catch (error) {
            request.log.error({ err: error }, "Roadmap generation failed");
            reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed to generate roadmap. Please try again.",
            });
        }
    };
}
