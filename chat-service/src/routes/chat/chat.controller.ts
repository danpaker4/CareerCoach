import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ChatMessageRequestBody } from "./chat.types";
import type { ProfileInput } from "./conversation/conversation.types";
import { ConversationNotFoundError, InvalidConversationIdError } from "./conversation/conversation.service";
import { ChatService } from "./chat.service";

const readOptionalConversationIdQuery = (request: FastifyRequest): string | undefined => {
    const query = request.query;
    if (typeof query !== "object" || query === null || !("conversationId" in query)) {
        return undefined;
    }
    const value = (query as { conversationId?: unknown }).conversationId;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const readOptionalUserProfileFromBody = (body: unknown): ProfileInput | undefined => {
    if (typeof body !== "object" || body === null || !("userProfile" in body)) {
        return undefined;
    }
    const profile = (body as { userProfile: unknown }).userProfile;
    return typeof profile === "object" && profile !== null ? (profile as ProfileInput) : undefined;
};

export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    listConversations = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId } = request.params as { userId: string };
            const conversations = await this.chatService.listConversationSummaries(userId);
            reply.status(StatusCodes.OK).send({ conversations });
        } catch (error) {
            request.log.error({ error }, "Failed listing conversations");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed listing conversations",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    createConversation = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId } = request.params as { userId: string };
            const profile = readOptionalUserProfileFromBody(request.body);
            const conversation = await this.chatService.createConversation(userId, profile);
            reply.status(StatusCodes.CREATED).send(conversation);
        } catch (error) {
            request.log.error({ error }, "Failed creating conversation");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed creating conversation",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    deleteConversation = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId, conversationId } = request.params as { userId: string; conversationId: string };
            await this.chatService.deleteConversation(userId, conversationId);
            reply.status(StatusCodes.NO_CONTENT).send();
            return;
        } catch (error) {
            if (error instanceof ConversationNotFoundError) {
                reply.status(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
                return;
            }
            if (error instanceof InvalidConversationIdError) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid conversation id" });
                return;
            }
            request.log.error({ error }, "Failed deleting conversation");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed deleting conversation",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    getConversation = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId } = request.params as { userId: string };
            const conversationId = readOptionalConversationIdQuery(request);
            const conversation = await this.chatService.getConversation(userId, conversationId);
            reply.status(StatusCodes.OK).send(conversation);
        } catch (error) {
            if (error instanceof ConversationNotFoundError) {
                reply.status(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
                return;
            }
            if (error instanceof InvalidConversationIdError) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid conversation id" });
                return;
            }
            request.log.error({ error }, "Failed loading conversation");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed loading conversation",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    sendMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const body = request.body as ChatMessageRequestBody;
            const response = await this.chatService.sendMessage(body.userId, body.message, body.userProfile, body.conversationId);
            reply.status(StatusCodes.OK).send(response);
        } catch (error) {
            if (error instanceof Error && error.message === "Message is required") {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: error.message });
                return;
            }
            if (error instanceof ConversationNotFoundError) {
                reply.status(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
                return;
            }
            if (error instanceof InvalidConversationIdError) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid conversation id" });
                return;
            }

            request.log.error({ error }, "Failed sending chat message");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed sending chat message",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
