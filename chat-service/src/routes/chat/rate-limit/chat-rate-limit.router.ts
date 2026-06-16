import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../../server.types";
import { AdminAuthService } from "../../admin/admin-auth.service";
import { CHAT_RATE_LIMIT_ROUTE_PREFIX } from "./chat-rate-limit.consts";
import { ChatRateLimitController } from "./chat-rate-limit.controller";
import { ChatRateLimitService } from "./chat-rate-limit.service";

export const chatRateLimitRouter = (
    rateLimitService: ChatRateLimitService,
    chatConfig: ServerConfig["chatConfig"]
) => async (app: FastifyInstance) => {
    const authService = new AdminAuthService(chatConfig.usersServiceBaseUrl);
    const controller = new ChatRateLimitController(rateLimitService, authService);

    app.get(`${CHAT_RATE_LIMIT_ROUTE_PREFIX}/config`, controller.getConfig);
    app.put(`${CHAT_RATE_LIMIT_ROUTE_PREFIX}/config`, controller.updateConfig);
};

