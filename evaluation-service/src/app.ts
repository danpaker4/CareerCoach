import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { evaluationCaseRoutes } from "./routes/evaluation-case.routes";
import type { RunnerConfig } from "./server.types";

export const buildApp = async (runnerConfig: RunnerConfig) => {
    const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.setErrorHandler((error: unknown, _request, reply) => {
        if (error instanceof ZodError) {
            reply.code(StatusCodes.BAD_REQUEST).send({
                error: "Validation failed",
                details: error.issues,
            });
            return;
        }

        if (
            typeof error === "object" &&
            error !== null &&
            "validation" in error &&
            Array.isArray(error.validation)
        ) {
            reply.code(StatusCodes.BAD_REQUEST).send({
                error: "Validation failed",
                details: error.validation,
            });
            return;
        }

        app.log.error(error);
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
            error: error instanceof Error ? error.message : "Internal server error",
        });
    });

    await app.register(cors, {
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    });

    await app.register(multipart, {
        limits: {
            fileSize: 1024 * 1024,
            files: 1,
        },
    });

    await app.register(evaluationCaseRoutes(runnerConfig), { prefix: "/evaluation-cases" });

    return app;
};
