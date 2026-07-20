import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import type { RunnerConfig } from "../server.types";
import {
    createEvaluationCaseRouteSchema,
    deleteEvaluationCaseRouteSchema,
    getEvaluationCaseRouteSchema,
    listEvaluationCasesRouteSchema,
    replaceEvaluationCaseRouteSchema,
    runEvaluationCaseRouteSchema,
} from "../schemas/evaluation-case.schema";
import {
    createEvaluationCase,
    deleteEvaluationCaseById,
    EvaluationCaseConflictError,
    EvaluationCaseNotFoundError,
    EvaluationCaseRequestIdMismatchError,
    getEvaluationCaseById,
    listEvaluationCases,
    replaceEvaluationCaseById,
} from "../services/evaluation-case.service";
import { EvaluationRunnerError, runEvaluationCaseById } from "../services/evaluation-runner.service";
import {
    formatEvaluationCaseRequestError,
    isEvaluationCaseRequestError,
    parseCreateEvaluationCaseInput,
} from "./evaluation-case.request.utils";

export const evaluationCaseRoutes = (runnerConfig: RunnerConfig): FastifyPluginAsyncZod => async (fastify) => {
    fastify.post("/", { schema: createEvaluationCaseRouteSchema }, async (request, reply) => {
        try {
            const input = await parseCreateEvaluationCaseInput(request);
            const saved = await createEvaluationCase(input);
            reply.code(StatusCodes.CREATED).send(saved);
        } catch (error) {
            if (isEvaluationCaseRequestError(error)) {
                reply.code(error.statusCode).send(formatEvaluationCaseRequestError(error));
                return;
            }
            if (error instanceof EvaluationCaseConflictError) {
                reply.code(StatusCodes.CONFLICT).send({ error: error.message });
                return;
            }
            throw error;
        }
    });

    fastify.get("/", { schema: listEvaluationCasesRouteSchema }, async (_request, reply) => {
        const cases = await listEvaluationCases();
        reply.code(StatusCodes.OK).send(cases);
    });

    fastify.post("/:id/run", { schema: runEvaluationCaseRouteSchema }, async (request, reply) => {
        try {
            const result = await runEvaluationCaseById(runnerConfig, request.params.id);
            reply.code(StatusCodes.OK).send(result);
        } catch (error) {
            if (error instanceof EvaluationCaseNotFoundError) {
                reply.code(StatusCodes.NOT_FOUND).send({ error: error.message });
                return;
            }
            if (error instanceof EvaluationRunnerError) {
                reply.code(error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : StatusCodes.BAD_GATEWAY).send({
                    error: error.message,
                });
                return;
            }
            throw error;
        }
    });

    fastify.put("/:id", { schema: replaceEvaluationCaseRouteSchema }, async (request, reply) => {
        try {
            const input = await parseCreateEvaluationCaseInput(request);
            const saved = await replaceEvaluationCaseById(request.params.id, input);
            reply.code(StatusCodes.OK).send(saved);
        } catch (error) {
            if (isEvaluationCaseRequestError(error)) {
                reply.code(error.statusCode).send(formatEvaluationCaseRequestError(error));
                return;
            }
            if (error instanceof EvaluationCaseNotFoundError) {
                reply.code(StatusCodes.NOT_FOUND).send({ error: error.message });
                return;
            }
            if (error instanceof EvaluationCaseRequestIdMismatchError) {
                reply.code(StatusCodes.BAD_REQUEST).send({ error: error.message, details: [] });
                return;
            }
            throw error;
        }
    });

    fastify.get("/:id", { schema: getEvaluationCaseRouteSchema }, async (request, reply) => {
        try {
            const evaluationCase = await getEvaluationCaseById(request.params.id);
            reply.code(StatusCodes.OK).send(evaluationCase);
        } catch (error) {
            if (error instanceof EvaluationCaseNotFoundError) {
                reply.code(StatusCodes.NOT_FOUND).send({ error: error.message });
                return;
            }
            throw error;
        }
    });

    fastify.delete("/:id", { schema: deleteEvaluationCaseRouteSchema }, async (request, reply) => {
        try {
            await deleteEvaluationCaseById(request.params.id);
            reply.code(StatusCodes.NO_CONTENT).send(null);
        } catch (error) {
            if (error instanceof EvaluationCaseNotFoundError) {
                reply.code(StatusCodes.NOT_FOUND).send({ error: error.message });
                return;
            }
            throw error;
        }
    });
};
