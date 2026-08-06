import type { FastifyRequest, FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { RoadmapGenerationService } from "./roadmap-generation.service";
import type { RoadmapGenerationRequestBody } from "./roadmap-generation.types";
import type { RoadmapEvalFixtureRequestBody } from "./roadmap-generation.fixture.types";
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

        const { userId, dreamJob, targetYears, availableHoursPerWeek } = body;

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

        if (
            availableHoursPerWeek !== undefined &&
            (!Number.isFinite(availableHoursPerWeek) || availableHoursPerWeek <= 0 || availableHoursPerWeek > 80)
        ) {
            reply.code(StatusCodes.BAD_REQUEST).send({
                error: "availableHoursPerWeek must be a positive number up to 80 when provided",
            });
            return;
        }

        try {
            const result = await this.service.generate(
                userId,
                dreamJob.trim(),
                targetYears,
                availableHoursPerWeek
            );
            reply.code(StatusCodes.OK).send(result);
        } catch (error) {
            request.log.error({ err: error }, "Roadmap generation failed");
            reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed to generate roadmap. Please try again.",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    generateEvalFixture = async (
        request: FastifyRequest<{ Body: RoadmapEvalFixtureRequestBody }>,
        reply: FastifyReply
    ): Promise<void> => {
        const body = request.body as RoadmapEvalFixtureRequestBody | undefined;
        if (!body || typeof body !== "object") {
            reply.code(StatusCodes.BAD_REQUEST).send({ error: "Request body is required" });
            return;
        }

        if (
            !body.dreamJob?.trim() ||
            !body.targetYears ||
            !Number.isInteger(body.targetYears) ||
            body.targetYears < MIN_TARGET_YEARS ||
            body.targetYears > MAX_TARGET_YEARS ||
            !body.startingPoint ||
            typeof body.startingPoint.isEntryLevel !== "boolean" ||
            !body.startingPoint.currentJob?.trim()
        ) {
            reply.code(StatusCodes.BAD_REQUEST).send({
                error: "dreamJob, targetYears, and startingPoint { currentJob, isEntryLevel } are required",
            });
            return;
        }

        try {
            const result = this.service.generateFromFixture(body);
            reply.code(StatusCodes.OK).send(result);
        } catch (error) {
            request.log.error({ err: error }, "Roadmap eval fixture generation failed");
            reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed to generate roadmap fixture.",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
