import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import {
    getPromptfooRunStatusRouteSchema,
    startPromptfooRunRouteSchema,
} from "../schemas/promptfoo-run.schema";
import {
    PromptfooRunConflictError,
    PromptfooRunNotConfiguredError,
    PromptfooRunService,
} from "../services/promptfoo-run.service";

export const promptfooRunRoutes = (promptfooRunService: PromptfooRunService): FastifyPluginAsyncZod => async (fastify) => {
    fastify.get("/runs/current", { schema: getPromptfooRunStatusRouteSchema }, async (_request, reply) => {
        reply.code(StatusCodes.OK).send(promptfooRunService.getStatus());
    });

    fastify.post("/runs", { schema: startPromptfooRunRouteSchema }, async (request, reply) => {
        try {
            const snapshot = await promptfooRunService.startRun({
                filterFirstN: request.body.filterFirstN,
                filterPattern: request.body.filterPattern,
                noCache: request.body.noCache,
            });
            reply.code(StatusCodes.ACCEPTED).send(snapshot);
        } catch (error) {
            if (error instanceof PromptfooRunConflictError) {
                reply.code(StatusCodes.CONFLICT).send({ error: error.message });
                return;
            }
            if (error instanceof PromptfooRunNotConfiguredError) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: error.message });
                return;
            }
            throw error;
        }
    });
};
