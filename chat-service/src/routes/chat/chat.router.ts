import type { FastifyInstance } from "fastify";
import type { Collection } from "mongodb";
import type { Conversation } from "./chat.model";
import { ChatController } from "./chat.controller";
import { ChatExternalService } from "./chat.external.service";
import { ChatLlmService } from "./chat.llm.service";
import { ChatRepository } from "./chat.repository";
import { ChatService } from "./chat.service";
import { ChatValidationService } from "./chat.validation.service";

export const chatRouter = (conversationsCollection: Collection<Conversation>) => async (app: FastifyInstance) => {
    const usersServiceBaseUrl = process.env.USERS_SERVICE_BASE_URL;
    const jobServiceBaseUrl = process.env.JOB_SERVICE_BASE_URL;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!usersServiceBaseUrl || !jobServiceBaseUrl || !geminiApiKey) {
        throw new Error("USERS_SERVICE_BASE_URL, JOB_SERVICE_BASE_URL, and GEMINI_API_KEY are required");
    }

    const repository = new ChatRepository(conversationsCollection);
    const externalService = new ChatExternalService(usersServiceBaseUrl, jobServiceBaseUrl);
    const llmService = new ChatLlmService(geminiApiKey);
    const validationService = new ChatValidationService();
    const service = new ChatService(repository, externalService, llmService, validationService);
    const controller = new ChatController(service);

    app.get("/chat/:userId", controller.getConversation);
    app.post("/chat/message", controller.sendMessage);

    // Backward-compatible endpoint for existing frontend clients.
    app.post("/api/chat", async (request, reply) => {
        const body = request.body as {
            userId?: string;
            message?: string;
            userProfile?: {
                firstName?: string;
                lastName?: string;
                currentJob?: string;
                achievements?: { id: string; name: string; grade: number }[];
            };
        } | null;
        const userId = typeof body?.userId === "string" && body.userId.trim() ? body.userId : "guest";
        const message = typeof body?.message === "string" ? body.message : "";
        const userProfile = body?.userProfile;

        request.body = { userId, message, userProfile };
        await controller.sendMessage(request, reply);
    });
};