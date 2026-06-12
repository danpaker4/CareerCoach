import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { AdminAuthService, type AdminAuthResult } from "../../admin/admin-auth.service";
import { ChatRateLimitService, ChatRateLimitValidationError } from "./chat-rate-limit.service";

const readAuthorizationHeader = (request: FastifyRequest): string | undefined => {
    const header = request.headers.authorization;
    return typeof header === "string" ? header : undefined;
};

const sendAuthFailure = (authResult: AdminAuthResult, reply: FastifyReply): boolean => {
    if (authResult.status === "success") {
        return false;
    }

    reply.status(authResult.failure.statusCode).send({
        error: authResult.failure.error,
        ...(authResult.failure.errorCode ? { errorCode: authResult.failure.errorCode } : {}),
    });
    return true;
};

export class ChatRateLimitController {
    constructor(
        private readonly rateLimitService: ChatRateLimitService,
        private readonly authService: AdminAuthService
    ) { }

    getConfig = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await this.authService.verifyAdmin(readAuthorizationHeader(request));
        if (sendAuthFailure(authResult, reply)) {
            return;
        }

        reply.status(StatusCodes.OK).send(await this.rateLimitService.getConfig());
    };

    updateConfig = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await this.authService.verifyAdmin(readAuthorizationHeader(request));
        if (authResult.status === "failure") {
            sendAuthFailure(authResult, reply);
            return;
        }

        try {
            const config = await this.rateLimitService.updateConfig(request.body, authResult.session);
            reply.status(StatusCodes.OK).send(config);
        } catch (error) {
            if (error instanceof ChatRateLimitValidationError) {
                reply.status(StatusCodes.BAD_REQUEST).send({
                    error: error.message,
                    errorCode: "CHAT_RATE_LIMIT_CONFIG_INVALID",
                });
                return;
            }

            request.log.error({ error }, "Failed updating chat rate limits");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed updating chat rate limits",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
